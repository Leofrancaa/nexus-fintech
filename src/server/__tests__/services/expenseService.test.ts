import { describe, it, expect } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { ExpenseService } from '@/server/services/expenseService'

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
      limite_disponivel: '500',
      dia_vencimento: 10,
      dias_fechamento_antes: 5,
      user_id: USER_ID,
      ...overrides,
    })
    .returning()
  return row
}

async function expensesOf(userId = USER_ID) {
  return db.select().from(schema.expenses).where(eq(schema.expenses.user_id, userId))
}

describe('ExpenseService.createExpense — débito simples', () => {
  it('cria despesa de débito sem afetar cartões', async () => {
    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'debito', tipo: 'Mercado', quantidade: 100 },
      USER_ID
    )

    expect(Array.isArray(result)).toBe(false)
    expect((result as { quantidade: number }).quantidade).toBe(100)
    expect(await expensesOf()).toHaveLength(1)
  })

  it('cria despesa via PIX', async () => {
    await ExpenseService.createExpense(
      { metodo_pagamento: 'pix', tipo: 'Aluguel', quantidade: 1500 },
      USER_ID
    )
    expect(await expensesOf()).toHaveLength(1)
  })
})

describe('ExpenseService.createExpense — despesa fixa (débito)', () => {
  it('cria despesa base e replica para os meses restantes do ano', async () => {
    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'debito', tipo: 'Netflix', quantidade: 39.9, fixo: true, data: '2025-01-15' },
      USER_ID
    )

    expect(Array.isArray(result)).toBe(false)
    // base (jan) + 11 réplicas (fev-dez)
    expect(await expensesOf()).toHaveLength(12)
  })

  it('não replica se a despesa começa em dezembro', async () => {
    await ExpenseService.createExpense(
      { metodo_pagamento: 'debito', tipo: 'Netflix', quantidade: 39.9, fixo: true, data: '2025-12-01' },
      USER_ID
    )
    expect(await expensesOf()).toHaveLength(1)
  })
})

describe('ExpenseService.createExpense — cartão de crédito simples', () => {
  it('cria despesa no crédito, decrementa limite e define competência', async () => {
    const card = await seedCard({ limite_disponivel: '500' })

    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Restaurante', quantidade: 100, card_id: card.id, data: '2025-01-03' },
      USER_ID
    )

    expect((result as { quantidade: number }).quantidade).toBe(100)

    const [updatedCard] = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id))
    expect(Number(updatedCard.limite_disponivel)).toBe(400) // 500 - 100

    const [exp] = await expensesOf()
    expect(exp.competencia_mes).not.toBeNull()
  })

  it('define a competência baseada na data de compra (compra antes do fechamento → fatura anterior)', async () => {
    const card = await seedCard({ dia_vencimento: 10, dias_fechamento_antes: 5 })

    await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Compra', quantidade: 50, card_id: card.id, data: '2025-01-03' },
      USER_ID
    )

    const [exp] = await expensesOf()
    expect(exp.competencia_mes).toBe(12)
    expect(exp.competencia_ano).toBe(2024)
  })
})

describe('ExpenseService.createExpense — cartão com limite insuficiente', () => {
  it('lança erro 400 quando limite é insuficiente', async () => {
    const card = await seedCard({ limite_disponivel: '500' })

    await expect(
      ExpenseService.createExpense(
        { metodo_pagamento: 'crédito', tipo: 'Compra cara', quantidade: 600, card_id: card.id, data: '2025-01-03' },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Limite insuficiente') })
  })
})

describe('ExpenseService.createExpense — fatura já paga', () => {
  it('lança erro quando a fatura do período já foi paga', async () => {
    const card = await seedCard()
    // Compra 2025-01-03 → competência 12/2024. Marca essa fatura como paga.
    await db.insert(schema.cardInvoicesPayments).values({
      user_id: USER_ID,
      card_id: card.id,
      competencia_mes: 12,
      competencia_ano: 2024,
      amount_paid: '50',
    })

    await expect(
      ExpenseService.createExpense(
        { metodo_pagamento: 'crédito', tipo: 'Compra', quantidade: 100, card_id: card.id, data: '2025-01-03' },
        USER_ID
      )
    ).rejects.toMatchObject({ message: expect.stringContaining('Esta fatura já foi paga') })
  })

  it('lança erro 404 quando cartão não existe', async () => {
    await expect(
      ExpenseService.createExpense(
        { metodo_pagamento: 'crédito', tipo: 'Compra', quantidade: 100, card_id: 999, data: '2025-01-03' },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('ExpenseService.createExpense — parcelamento', () => {
  it('cria 3 parcelas e decrementa o total do limite', async () => {
    const card = await seedCard({ limite_disponivel: '500' })

    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Notebook', quantidade: 300, parcelas: 3, card_id: card.id, data: '2025-01-15' },
      USER_ID
    )

    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(3)

    const exps = await expensesOf()
    expect(exps).toHaveLength(3)
    for (const e of exps) expect(Number(e.quantidade)).toBe(100)

    const [updatedCard] = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id))
    expect(Number(updatedCard.limite_disponivel)).toBe(200) // 500 - 300
  })
})

describe('ExpenseService.createExpense — crédito fixo', () => {
  it('cria despesa base e replica para meses com fatura em aberto', async () => {
    const card = await seedCard({ limite_disponivel: '500' })

    await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Spotify', quantidade: 19.9, fixo: true, card_id: card.id, data: '2025-01-15' },
      USER_ID
    )

    // base + réplicas dos meses seguintes (todas as faturas em aberto)
    expect((await expensesOf()).length).toBeGreaterThan(1)
  })
})

describe('ExpenseService.deleteExpense', () => {
  async function seedExpense(overrides: Partial<typeof schema.expenses.$inferInsert> = {}) {
    const [row] = await db
      .insert(schema.expenses)
      .values({
        metodo_pagamento: 'debito',
        tipo: 'Mercado',
        quantidade: '100',
        fixo: false,
        data: new Date('2025-01-15T12:00:00'),
        user_id: USER_ID,
        ...overrides,
      })
      .returning()
    return row
  }

  it('deleta despesa simples de débito', async () => {
    const exp = await seedExpense()

    const result = await ExpenseService.deleteExpense(exp.id, USER_ID)

    expect((result as { id: number }).id).toBe(exp.id)
    expect(await expensesOf()).toHaveLength(0)
  })

  it('deleta despesa de crédito e restaura o limite do cartão', async () => {
    const card = await seedCard({ limite_disponivel: '350' })
    const exp = await seedExpense({ metodo_pagamento: 'crédito', card_id: card.id, quantidade: '150' })

    await ExpenseService.deleteExpense(exp.id, USER_ID)

    const [updatedCard] = await db.select().from(schema.cards).where(eq(schema.cards.id, card.id))
    expect(Number(updatedCard.limite_disponivel)).toBe(500) // 350 + 150
  })

  it('deleta despesa fixa e todas as futuras de mesmo tipo/valor', async () => {
    await seedExpense({ fixo: true, tipo: 'Netflix', quantidade: '30', data: new Date('2025-01-15T12:00:00') })
    await seedExpense({ fixo: true, tipo: 'Netflix', quantidade: '30', data: new Date('2025-02-15T12:00:00') })
    const first = (await expensesOf())[0]

    const result = await ExpenseService.deleteExpense(first.id, USER_ID)

    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(2)

    const remaining = await db
      .select()
      .from(schema.expenses)
      .where(and(eq(schema.expenses.tipo, 'Netflix'), eq(schema.expenses.fixo, true)))
    expect(remaining).toHaveLength(0)
  })

  it('lança erro 404 quando despesa não existe', async () => {
    await expect(ExpenseService.deleteExpense(999, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('ExpenseService.updateExpense', () => {
  async function seedDebitExpense() {
    const [row] = await db
      .insert(schema.expenses)
      .values({
        metodo_pagamento: 'debito',
        tipo: 'Mercado',
        quantidade: '100',
        data: new Date('2025-01-15T12:00:00'),
        user_id: USER_ID,
      })
      .returning()
    return row
  }

  it('atualiza campos permitidos de uma despesa de débito', async () => {
    const exp = await seedDebitExpense()

    const result = await ExpenseService.updateExpense(
      exp.id,
      { tipo: 'Supermercado', quantidade: 200 },
      USER_ID
    )

    expect((result as { tipo: string }).tipo).toBe('Supermercado')
    expect((result as { quantidade: number }).quantidade).toBe(200)
  })

  it('lança erro 400 para despesa de crédito (não pode editar)', async () => {
    const [credit] = await db
      .insert(schema.expenses)
      .values({
        metodo_pagamento: 'crédito',
        tipo: 'Compra',
        quantidade: '100',
        data: new Date('2025-01-15T12:00:00'),
        user_id: USER_ID,
        card_id: 1,
      })
      .returning()

    await expect(
      ExpenseService.updateExpense(credit.id, { tipo: 'Editado' }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 404 quando despesa não existe', async () => {
    await expect(
      ExpenseService.updateExpense(999, { tipo: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('retorna despesa sem alterar quando nenhum campo é enviado', async () => {
    const exp = await seedDebitExpense()

    const result = await ExpenseService.updateExpense(exp.id, {}, USER_ID)

    expect((result as { id: number }).id).toBe(exp.id)
  })
})
