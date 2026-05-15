import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { ExpenseService } from '@/server/services/expenseService'

const USER_ID = 1

function makeExpenseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    metodo_pagamento: 'debito',
    tipo: 'Mercado',
    quantidade: 100,
    fixo: false,
    data: new Date('2025-01-15'),
    parcelas: null,
    frequencia: null,
    user_id: USER_ID,
    card_id: null,
    category_id: null,
    observacoes: null,
    competencia_mes: null,
    competencia_ano: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    limite_disponivel: 500,
    dia_vencimento: 10,
    dias_fechamento_antes: 5,
    ...overrides,
  }
}

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()
})

describe('ExpenseService.createExpense — débito simples', () => {
  it('cria despesa de débito sem acionar card.update', async () => {
    const record = makeExpenseRecord()
    prismaMock.expense.create.mockResolvedValue(record as never)

    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'debito', tipo: 'Mercado', quantidade: 100 },
      USER_ID
    )

    expect(prismaMock.expense.create).toHaveBeenCalledOnce()
    expect(prismaMock.card.update).not.toHaveBeenCalled()
    expect(Array.isArray(result)).toBe(false)
    expect((result as { quantidade: number }).quantidade).toBe(100)
  })

  it('cria despesa via PIX sem acionar card.update', async () => {
    const record = makeExpenseRecord({ metodo_pagamento: 'pix', tipo: 'Aluguel' })
    prismaMock.expense.create.mockResolvedValue(record as never)

    await ExpenseService.createExpense(
      { metodo_pagamento: 'pix', tipo: 'Aluguel', quantidade: 1500 },
      USER_ID
    )

    expect(prismaMock.expense.create).toHaveBeenCalledOnce()
    expect(prismaMock.card.update).not.toHaveBeenCalled()
  })
})

describe('ExpenseService.createExpense — despesa fixa (débito)', () => {
  it('cria despesa base e replica para os meses restantes do ano', async () => {
    const record = makeExpenseRecord({ fixo: true, data: new Date('2025-01-15') })
    prismaMock.expense.create.mockResolvedValue(record as never)
    prismaMock.expense.createMany.mockResolvedValue({ count: 11 } as never)

    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'debito', tipo: 'Netflix', quantidade: 39.9, fixo: true, data: '2025-01-15' },
      USER_ID
    )

    // Cria a despesa base
    expect(prismaMock.expense.create).toHaveBeenCalledOnce()
    // Replica para os meses restantes (Fev a Dez = 11 meses)
    expect(prismaMock.expense.createMany).toHaveBeenCalledOnce()
    const createManyCall = prismaMock.expense.createMany.mock.calls[0][0] as { data: unknown[] }
    expect(createManyCall.data).toHaveLength(11)
    expect(Array.isArray(result)).toBe(false)
  })

  it('não replica se a despesa começa em dezembro', async () => {
    const record = makeExpenseRecord({ fixo: true, data: new Date('2025-12-01') })
    prismaMock.expense.create.mockResolvedValue(record as never)

    await ExpenseService.createExpense(
      { metodo_pagamento: 'debito', tipo: 'Netflix', quantidade: 39.9, fixo: true, data: '2025-12-01' },
      USER_ID
    )

    expect(prismaMock.expense.create).toHaveBeenCalledOnce()
    // Nenhum mês restante
    expect(prismaMock.expense.createMany).not.toHaveBeenCalled()
  })
})

describe('ExpenseService.createExpense — cartão de crédito simples', () => {
  it('cria despesa no crédito, decrementa limite e define competência', async () => {
    const card = makeCard()
    const compra = makeExpenseRecord({
      metodo_pagamento: 'crédito',
      card_id: 1,
      competencia_mes: 1,
      competencia_ano: 2025,
    })

    prismaMock.card.findFirst.mockResolvedValue(card as never)
    prismaMock.cardInvoicePayment.count.mockResolvedValue(0)
    prismaMock.expense.create.mockResolvedValue(compra as never)
    prismaMock.card.update.mockResolvedValue({} as never)

    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Restaurante', quantidade: 100, card_id: 1, data: '2025-01-03' },
      USER_ID
    )

    expect(prismaMock.card.findFirst).toHaveBeenCalledOnce()
    expect(prismaMock.expense.create).toHaveBeenCalledOnce()
    expect(prismaMock.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { limite_disponivel: { decrement: 100 } },
      })
    )
    expect((result as { quantidade: number }).quantidade).toBe(100)
  })

  it('define a competência baseada na data de compra e configuração do cartão', async () => {
    // dueDay=10, closeDaysBefore=5 → fechamento dia 5
    // Compra no dia 3 jan → ANTES do fechamento (dia 5) → competência DEZEMBRO 2024
    // (a fatura que fecha no dia 5 jan e vence 10 jan é a "fatura de dezembro")
    const card = makeCard({ dia_vencimento: 10, dias_fechamento_antes: 5 })
    const compra = makeExpenseRecord({
      metodo_pagamento: 'crédito',
      card_id: 1,
      data: new Date('2025-01-03'),
    })

    prismaMock.card.findFirst.mockResolvedValue(card as never)
    prismaMock.cardInvoicePayment.count.mockResolvedValue(0)
    prismaMock.expense.create.mockResolvedValue(compra as never)
    prismaMock.card.update.mockResolvedValue({} as never)

    await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Compra', quantidade: 50, card_id: 1, data: '2025-01-03' },
      USER_ID
    )

    const createCall = prismaMock.expense.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.competencia_mes).toBe(12) // Dezembro 2024 — fatura anterior
    expect(createCall.data.competencia_ano).toBe(2024)
  })
})

describe('ExpenseService.createExpense — cartão com limite insuficiente', () => {
  it('lança erro com status 400 quando limite é insuficiente', async () => {
    prismaMock.card.findFirst.mockResolvedValue(makeCard({ limite_disponivel: 500 }) as never)

    await expect(
      ExpenseService.createExpense(
        { metodo_pagamento: 'crédito', tipo: 'Compra cara', quantidade: 600, card_id: 1, data: '2025-01-03' },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Limite insuficiente') })
  })
})

describe('ExpenseService.createExpense — fatura já paga', () => {
  it('lança erro quando a fatura do período já foi paga', async () => {
    prismaMock.card.findFirst.mockResolvedValue(makeCard() as never)
    // Simula fatura paga
    prismaMock.cardInvoicePayment.count.mockResolvedValue(1)

    await expect(
      ExpenseService.createExpense(
        { metodo_pagamento: 'crédito', tipo: 'Compra', quantidade: 100, card_id: 1, data: '2025-01-03' },
        USER_ID
      )
    ).rejects.toMatchObject({ message: expect.stringContaining('Esta fatura já foi paga') })
  })

  it('lança erro 404 quando cartão não existe', async () => {
    prismaMock.card.findFirst.mockResolvedValue(null)

    await expect(
      ExpenseService.createExpense(
        { metodo_pagamento: 'crédito', tipo: 'Compra', quantidade: 100, card_id: 999, data: '2025-01-03' },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('ExpenseService.createExpense — parcelamento', () => {
  it('cria 3 parcelas em transação e decrementa o total do limite', async () => {
    const card = makeCard()
    prismaMock.card.findFirst.mockResolvedValue(card as never)
    prismaMock.cardInvoicePayment.count.mockResolvedValue(0)

    const parcelasMock = [
      makeExpenseRecord({ id: 1, tipo: 'Notebook (1/3)', quantidade: 100 }),
      makeExpenseRecord({ id: 2, tipo: 'Notebook (2/3)', quantidade: 100 }),
      makeExpenseRecord({ id: 3, tipo: 'Notebook (3/3)', quantidade: 100 }),
    ]

    // $transaction recebe array de promises
    prismaMock.$transaction.mockImplementation(
      async (ops: unknown) => Promise.all(ops as Promise<unknown>[])
    )
    prismaMock.expense.create
      .mockResolvedValueOnce(parcelasMock[0] as never)
      .mockResolvedValueOnce(parcelasMock[1] as never)
      .mockResolvedValueOnce(parcelasMock[2] as never)
    prismaMock.card.update.mockResolvedValue({} as never)

    const result = await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Notebook', quantidade: 300, parcelas: 3, card_id: 1, data: '2025-01-15' },
      USER_ID
    )

    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(3)

    // Decrementa o total (300), não por parcela
    expect(prismaMock.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { limite_disponivel: { decrement: 300 } },
      })
    )
  })

  it('cada parcela tem valor dividido igualmente', async () => {
    const card = makeCard()
    prismaMock.card.findFirst.mockResolvedValue(card as never)
    prismaMock.cardInvoicePayment.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation(
      async (ops: unknown) => Promise.all(ops as Promise<unknown>[])
    )

    const parcelasMock = Array.from({ length: 3 }, (_, i) =>
      makeExpenseRecord({ id: i + 1, tipo: `Notebook (${i + 1}/3)`, quantidade: 100 })
    )
    prismaMock.expense.create
      .mockResolvedValueOnce(parcelasMock[0] as never)
      .mockResolvedValueOnce(parcelasMock[1] as never)
      .mockResolvedValueOnce(parcelasMock[2] as never)
    prismaMock.card.update.mockResolvedValue({} as never)

    await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Notebook', quantidade: 300, parcelas: 3, card_id: 1, data: '2025-01-15' },
      USER_ID
    )

    // Verifica que cada expense.create recebeu quantidade = 100
    for (const call of prismaMock.expense.create.mock.calls) {
      const data = (call[0] as { data: Record<string, unknown> }).data
      expect(Number(data.quantidade)).toBe(100)
    }
  })
})

describe('ExpenseService.createExpense — crédito fixo', () => {
  it('cria despesa base e consulta faturas pagas antes de replicar', async () => {
    const card = makeCard()
    const baseRecord = makeExpenseRecord({
      metodo_pagamento: 'crédito',
      card_id: 1,
      fixo: true,
      data: new Date('2025-01-15'),
    })

    prismaMock.card.findFirst.mockResolvedValue(card as never)
    // Primeira chamada: verificar se fatura da competência base está paga
    // Demais chamadas: verificar meses seguintes (11 meses)
    prismaMock.cardInvoicePayment.count.mockResolvedValue(0)
    prismaMock.expense.create.mockResolvedValue(baseRecord as never)
    prismaMock.card.update.mockResolvedValue({} as never)
    prismaMock.expense.createMany.mockResolvedValue({ count: 11 } as never)

    await ExpenseService.createExpense(
      { metodo_pagamento: 'crédito', tipo: 'Spotify', quantidade: 19.9, fixo: true, card_id: 1, data: '2025-01-15' },
      USER_ID
    )

    expect(prismaMock.expense.create).toHaveBeenCalledOnce()
    expect(prismaMock.card.update).toHaveBeenCalledOnce()
    // Deve chamar cardInvoicePayment.count para verificar os meses restantes
    expect(prismaMock.cardInvoicePayment.count).toHaveBeenCalled()
  })
})

describe('ExpenseService.deleteExpense', () => {
  it('deleta despesa simples de débito', async () => {
    const expense = makeExpenseRecord({ fixo: false, metodo_pagamento: 'debito' })
    prismaMock.expense.findFirst.mockResolvedValue(expense as never)
    prismaMock.expense.delete.mockResolvedValue(expense as never)

    const result = await ExpenseService.deleteExpense(1, USER_ID)

    expect(prismaMock.expense.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(prismaMock.card.update).not.toHaveBeenCalled()
    expect((result as { id: number }).id).toBe(1)
  })

  it('deleta despesa de crédito e restaura o limite do cartão', async () => {
    const expense = makeExpenseRecord({
      metodo_pagamento: 'crédito',
      card_id: 1,
      quantidade: 150,
      fixo: false,
    })
    prismaMock.expense.findFirst.mockResolvedValue(expense as never)
    prismaMock.expense.delete.mockResolvedValue(expense as never)
    prismaMock.card.update.mockResolvedValue({} as never)

    await ExpenseService.deleteExpense(1, USER_ID)

    expect(prismaMock.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: { limite_disponivel: { increment: 150 } },
      })
    )
    expect(prismaMock.expense.delete).toHaveBeenCalledWith({ where: { id: 1 } })
  })

  it('deleta despesa fixa e todas as futuras', async () => {
    const baseDate = new Date('2025-01-15')
    const expense = makeExpenseRecord({
      fixo: true,
      tipo: 'Netflix',
      quantidade: 30,
      data: baseDate,
      metodo_pagamento: 'debito',
    })
    const toDelete = [expense, makeExpenseRecord({ id: 2, fixo: true, data: new Date('2025-02-15') })]

    prismaMock.expense.findFirst.mockResolvedValue(expense as never)
    prismaMock.expense.findMany.mockResolvedValue(toDelete as never)
    prismaMock.expense.deleteMany.mockResolvedValue({ count: 2 } as never)

    const result = await ExpenseService.deleteExpense(1, USER_ID)

    expect(prismaMock.expense.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user_id: USER_ID,
          tipo: 'Netflix',
          fixo: true,
          data: { gte: baseDate },
        }),
      })
    )
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(2)
  })

  it('lança erro 404 quando despesa não existe', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(null)

    await expect(ExpenseService.deleteExpense(999, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('ExpenseService.updateExpense', () => {
  it('atualiza campos permitidos de uma despesa de débito', async () => {
    const expense = makeExpenseRecord({ metodo_pagamento: 'debito' })
    const updated = makeExpenseRecord({ metodo_pagamento: 'debito', tipo: 'Supermercado', quantidade: 200 })

    prismaMock.expense.findFirst.mockResolvedValue(expense as never)
    prismaMock.expense.update.mockResolvedValue(updated as never)

    const result = await ExpenseService.updateExpense(
      1,
      { tipo: 'Supermercado', quantidade: 200 },
      USER_ID
    )

    expect(prismaMock.expense.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ tipo: 'Supermercado', quantidade: 200 }),
      })
    )
    expect((result as { tipo: string }).tipo).toBe('Supermercado')
  })

  it('lança erro 400 para despesa de crédito (não pode editar)', async () => {
    const creditExpense = makeExpenseRecord({ metodo_pagamento: 'crédito', card_id: 1 })
    prismaMock.expense.findFirst.mockResolvedValue(creditExpense as never)

    await expect(
      ExpenseService.updateExpense(1, { tipo: 'Editado' }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 404 quando despesa não existe', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(null)

    await expect(
      ExpenseService.updateExpense(999, { tipo: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('retorna despesa sem chamar update quando nenhum campo é enviado', async () => {
    const expense = makeExpenseRecord()
    prismaMock.expense.findFirst.mockResolvedValue(expense as never)

    const result = await ExpenseService.updateExpense(1, {}, USER_ID)

    expect(prismaMock.expense.update).not.toHaveBeenCalled()
    expect((result as { id: number }).id).toBe(1)
  })
})
