import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { CardService } from '@/server/services/cardService'

const USER_ID = 1

async function seedCard(overrides: Partial<typeof schema.cards.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.cards)
    .values({
      nome: 'Nubank',
      tipo: 'crédito',
      numero: '1234',
      cor: '#8A2BE2',
      limite: '1000',
      limite_disponivel: '1000',
      dia_vencimento: 10,
      dias_fechamento_antes: 5,
      user_id: USER_ID,
      ...overrides,
    })
    .returning()
  return row
}

async function seedExpense(cardId: number, quantidade: string, data: Date) {
  await db.insert(schema.expenses).values({
    metodo_pagamento: 'credito',
    tipo: 'compra',
    quantidade,
    data,
    user_id: USER_ID,
    card_id: cardId,
  })
}

// ─── createCard ──────────────────────────────────────────────────────────────

describe('CardService.createCard', () => {
  it('cria cartão de crédito com sucesso', async () => {
    const result = await CardService.createCard(
      { nome: 'Nubank', tipo: 'crédito', numero: '1234', cor: '#8A2BE2', limite: 1000, dia_vencimento: 10 },
      USER_ID
    )

    expect(result.nome).toBe('Nubank')
    expect(result.limite).toBe(1000)
  })

  it('cria cartão de débito com dia_vencimento=1 e dias_fechamento_antes=1', async () => {
    await CardService.createCard({ nome: 'Conta', tipo: 'débito', numero: '5678', limite: 0 }, USER_ID)

    const [row] = await db.select().from(schema.cards).where(eq(schema.cards.numero, '5678'))
    expect(row.dia_vencimento).toBe(1)
    expect(row.dias_fechamento_antes).toBe(1)
  })

  it('lança erro 400 quando número não tem 4 dígitos', async () => {
    await expect(
      CardService.createCard({ nome: 'Nubank', tipo: 'crédito', numero: '12', limite: 1000, dia_vencimento: 10 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('4 dígitos') })
  })

  it('lança erro 400 quando cartão de crédito não tem dia_vencimento', async () => {
    await expect(
      CardService.createCard({ nome: 'Nubank', tipo: 'crédito', numero: '1234', limite: 1000 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('vencimento') })
  })

  it('lança erro 400 quando cartão de crédito tem limite zero', async () => {
    await expect(
      CardService.createCard({ nome: 'Nubank', tipo: 'crédito', numero: '1234', limite: 0, dia_vencimento: 10 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('positivo') })
  })

  it('lança erro 400 quando dia_vencimento está fora do range 1-31', async () => {
    await expect(
      CardService.createCard({ nome: 'N', tipo: 'crédito', numero: '1234', limite: 500, dia_vencimento: 32 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })
})

// ─── updateCard ──────────────────────────────────────────────────────────────

describe('CardService.updateCard', () => {
  it('atualiza nome do cartão com sucesso', async () => {
    const card = await seedCard()

    const result = await CardService.updateCard(card.id, { nome: 'Nubank Gold' }, USER_ID)

    expect(result.nome).toBe('Nubank Gold')
  })

  it('lança erro 400 quando novo limite é menor que saldo em aberto', async () => {
    const card = await seedCard()
    // Despesa de 600 sem pagamento → saldo em aberto = 600
    await seedExpense(card.id, '600', new Date('2025-01-10T12:00:00'))

    await expect(
      CardService.updateCard(card.id, { limite: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('saldo em aberto') })
  })

  it('atualiza limite quando novo valor é maior que saldo em aberto', async () => {
    const card = await seedCard()
    await seedExpense(card.id, '300', new Date('2025-01-10T12:00:00'))

    const result = await CardService.updateCard(card.id, { limite: 1200 }, USER_ID)

    expect(result.limite).toBe(1200)
    expect(result.limite_disponivel).toBe(900) // 1200 - 300 em aberto
  })

  it('lança erro 400 quando número de atualização não tem 4 dígitos', async () => {
    await expect(
      CardService.updateCard(1, { numero: '12345' }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 404 quando cartão não encontrado (sem limite)', async () => {
    await expect(
      CardService.updateCard(999, { nome: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── deleteCard ──────────────────────────────────────────────────────────────

describe('CardService.deleteCard', () => {
  it('deleta cartão sem despesas diretamente', async () => {
    const card = await seedCard()

    const result = await CardService.deleteCard(card.id, USER_ID)

    expect(result.message).toContain('sucesso')
    const rows = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id))
    expect(rows).toHaveLength(0)
  })

  it('lança erro 400 quando há despesas no mês atual', async () => {
    const card = await seedCard()
    await seedExpense(card.id, '100', new Date()) // mês atual

    await expect(
      CardService.deleteCard(card.id, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('mês atual') })
  })

  it('deleta cartão e despesas passadas em transação', async () => {
    const card = await seedCard()
    await seedExpense(card.id, '100', new Date('2020-01-10T12:00:00')) // passado

    const result = await CardService.deleteCard(card.id, USER_ID)

    expect(result.message).toContain('despesas anteriores')
    const cards = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id))
    const exps = await db.select().from(schema.expenses).where(eq(schema.expenses.card_id, card.id))
    expect(cards).toHaveLength(0)
    expect(exps).toHaveLength(0)
  })

  it('lança erro 404 quando cartão não existe e não há despesas', async () => {
    await expect(
      CardService.deleteCard(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})
