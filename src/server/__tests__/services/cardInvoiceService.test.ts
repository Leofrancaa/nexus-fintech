import { describe, it, expect } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { CardInvoiceService } from '@/server/services/cardInvoiceService'

const USER_ID = 1

// Competência passada (garante que a fatura já fechou nos testes)
const COMP_MES = 1
const COMP_ANO = 2024

async function seedCard(overrides: Partial<typeof schema.cards.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.cards)
    .values({
      nome: 'Nubank',
      tipo: 'crédito',
      numero: '1234',
      cor: '#8A2BE2',
      limite: '1000',
      limite_disponivel: '200',
      dia_vencimento: 10,
      dias_fechamento_antes: 5,
      user_id: USER_ID,
      ...overrides,
    })
    .returning()
  return row
}

async function seedExpenseComp(cardId: number, quantidade: string) {
  await db.insert(schema.expenses).values({
    metodo_pagamento: 'credito',
    tipo: 'compra',
    quantidade,
    data: new Date(`${COMP_ANO}-0${COMP_MES}-15T12:00:00`),
    user_id: USER_ID,
    card_id: cardId,
    competencia_mes: COMP_MES,
    competencia_ano: COMP_ANO,
  })
}

async function seedPayment(cardId: number, amount: string) {
  await db.insert(schema.cardInvoicesPayments).values({
    user_id: USER_ID,
    card_id: cardId,
    competencia_mes: COMP_MES,
    competencia_ano: COMP_ANO,
    amount_paid: amount,
  })
}

describe('CardInvoiceService.payCardInvoice', () => {
  it('paga fatura com sucesso e restaura o limite do cartão', async () => {
    const card = await seedCard({ limite_disponivel: '200' })
    await seedExpenseComp(card.id, '300')

    const result = await CardInvoiceService.payCardInvoice({
      user_id: USER_ID,
      card_id: card.id,
      mes: COMP_MES,
      ano: COMP_ANO,
    })

    expect(result.total_devolvido).toBe(300)

    const [updated] = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id))
    expect(Number(updated.limite_disponivel)).toBe(500) // 200 + 300

    const payments = await db
      .select()
      .from(schema.cardInvoicesPayments)
      .where(eq(schema.cardInvoicesPayments.card_id, card.id))
    expect(payments).toHaveLength(1)
  })

  it('lança erro 404 quando cartão não existe', async () => {
    await expect(
      CardInvoiceService.payCardInvoice({ user_id: USER_ID, card_id: 999, mes: COMP_MES, ano: COMP_ANO })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando não há despesas na competência', async () => {
    const card = await seedCard()

    await expect(
      CardInvoiceService.payCardInvoice({ user_id: USER_ID, card_id: card.id, mes: COMP_MES, ano: COMP_ANO })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Não há despesas') })
  })

  it('lança erro quando fatura já foi paga', async () => {
    const card = await seedCard()
    await seedExpenseComp(card.id, '200')
    await seedPayment(card.id, '200')

    await expect(
      CardInvoiceService.payCardInvoice({ user_id: USER_ID, card_id: card.id, mes: COMP_MES, ano: COMP_ANO })
    ).rejects.toMatchObject({ message: expect.stringContaining('já foi paga') })
  })
})

describe('CardInvoiceService.canPayInvoice', () => {
  it('retorna can_pay=true para fatura passada não paga', async () => {
    const card = await seedCard()

    const result = await CardInvoiceService.canPayInvoice(USER_ID, card.id, COMP_MES, COMP_ANO)

    expect(result.can_pay).toBe(true)
  })

  it('retorna can_pay=false com reason quando fatura já paga', async () => {
    const card = await seedCard()
    await seedPayment(card.id, '300')

    const result = await CardInvoiceService.canPayInvoice(USER_ID, card.id, COMP_MES, COMP_ANO)

    expect(result.can_pay).toBe(false)
    expect(result.reason).toContain('já foi paga')
  })

  it('retorna can_pay=false quando cartão não encontrado', async () => {
    const result = await CardInvoiceService.canPayInvoice(USER_ID, 999, COMP_MES, COMP_ANO)
    expect(result.can_pay).toBe(false)
  })
})

describe('CardInvoiceService.cancelInvoicePayment', () => {
  it('cancela pagamento e decrementa o limite', async () => {
    const card = await seedCard({ limite_disponivel: '800', limite: '1000' })
    await seedPayment(card.id, '300')

    const result = await CardInvoiceService.cancelInvoicePayment(USER_ID, card.id, COMP_MES, COMP_ANO)

    expect(result.amount_reverted).toBe(300)

    const [updated] = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id))
    expect(Number(updated.limite_disponivel)).toBe(500) // 800 - 300

    const payments = await db
      .select()
      .from(schema.cardInvoicesPayments)
      .where(and(eq(schema.cardInvoicesPayments.card_id, card.id)))
    expect(payments).toHaveLength(0)
  })

  it('lança erro 404 quando pagamento não encontrado', async () => {
    await expect(
      CardInvoiceService.cancelInvoicePayment(USER_ID, 1, COMP_MES, COMP_ANO)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando cancelamento deixaria limite negativo', async () => {
    const card = await seedCard({ limite_disponivel: '100', limite: '1000' })
    await seedPayment(card.id, '500')

    await expect(
      CardInvoiceService.cancelInvoicePayment(USER_ID, card.id, COMP_MES, COMP_ANO)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('negativo') })
  })
})
