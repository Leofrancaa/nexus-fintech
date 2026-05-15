import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { CardInvoiceService } from '@/server/services/cardInvoiceService'

const USER_ID = 1
const CARD_ID = 1

// Competência passada (garante que a fatura já fechou nos testes)
const COMP_MES = 1   // Janeiro 2024 — sempre no passado
const COMP_ANO = 2024

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    dia_vencimento: 10,
    dias_fechamento_antes: 5,
    limite_disponivel: 200,
    limite: 1000,
    ...overrides,
  }
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: USER_ID,
    card_id: CARD_ID,
    competencia_mes: COMP_MES,
    competencia_ano: COMP_ANO,
    amount_paid: 300,
    created_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()

  // Mock padrão de $transaction com callback
  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock)
    return Promise.all(fn as Promise<unknown>[])
  })
})

describe('CardInvoiceService.payCardInvoice', () => {
  it('paga fatura com sucesso e restaura o limite do cartão', async () => {
    prismaMock.card.findFirst.mockResolvedValue(makeCard() as never)
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { quantidade: 300 } } as never)
    prismaMock.cardInvoicePayment.findFirst.mockResolvedValue(null)
    prismaMock.card.update.mockResolvedValue({} as never)
    prismaMock.cardInvoicePayment.create.mockResolvedValue({} as never)

    const result = await CardInvoiceService.payCardInvoice({
      user_id: USER_ID,
      card_id: CARD_ID,
      mes: COMP_MES,
      ano: COMP_ANO,
    })

    expect(result.competencia_mes).toBe(COMP_MES)
    expect(result.competencia_ano).toBe(COMP_ANO)
    expect(result.total_devolvido).toBe(300)
    expect(prismaMock.card.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { limite_disponivel: { increment: 300 } } })
    )
    expect(prismaMock.cardInvoicePayment.create).toHaveBeenCalledOnce()
  })

  it('lança erro 404 quando cartão não existe', async () => {
    prismaMock.card.findFirst.mockResolvedValue(null)

    await expect(
      CardInvoiceService.payCardInvoice({ user_id: USER_ID, card_id: 999, mes: COMP_MES, ano: COMP_ANO })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando não há despesas na competência', async () => {
    prismaMock.card.findFirst.mockResolvedValue(makeCard() as never)
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { quantidade: null } } as never)

    await expect(
      CardInvoiceService.payCardInvoice({ user_id: USER_ID, card_id: CARD_ID, mes: COMP_MES, ano: COMP_ANO })
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('Não há despesas') })
  })

  it('lança erro quando fatura já foi paga (dentro da transação)', async () => {
    prismaMock.card.findFirst.mockResolvedValue(makeCard() as never)
    prismaMock.expense.aggregate.mockResolvedValue({ _sum: { quantidade: 200 } } as never)
    // Simula que já existe um pagamento
    prismaMock.cardInvoicePayment.findFirst.mockResolvedValue(makePayment() as never)

    await expect(
      CardInvoiceService.payCardInvoice({ user_id: USER_ID, card_id: CARD_ID, mes: COMP_MES, ano: COMP_ANO })
    ).rejects.toMatchObject({ message: expect.stringContaining('já foi paga') })
  })
})

describe('CardInvoiceService.canPayInvoice', () => {
  it('retorna can_pay=true para fatura passada não paga', async () => {
    prismaMock.card.findFirst.mockResolvedValue(makeCard() as never)
    prismaMock.cardInvoicePayment.findFirst.mockResolvedValue(null)

    const result = await CardInvoiceService.canPayInvoice(USER_ID, CARD_ID, COMP_MES, COMP_ANO)

    expect(result.can_pay).toBe(true)
  })

  it('retorna can_pay=false com reason quando fatura já paga', async () => {
    prismaMock.card.findFirst.mockResolvedValue(makeCard() as never)
    prismaMock.cardInvoicePayment.findFirst.mockResolvedValue(makePayment() as never)

    const result = await CardInvoiceService.canPayInvoice(USER_ID, CARD_ID, COMP_MES, COMP_ANO)

    expect(result.can_pay).toBe(false)
    expect(result.reason).toContain('já foi paga')
  })

  it('retorna can_pay=false quando cartão não encontrado', async () => {
    prismaMock.card.findFirst.mockResolvedValue(null)

    const result = await CardInvoiceService.canPayInvoice(USER_ID, CARD_ID, COMP_MES, COMP_ANO)

    expect(result.can_pay).toBe(false)
  })
})

describe('CardInvoiceService.cancelInvoicePayment', () => {
  it('cancela pagamento e decrementa o limite', async () => {
    const payment = makePayment({ amount_paid: 300 })
    prismaMock.cardInvoicePayment.findFirst.mockResolvedValue(payment as never)
    prismaMock.card.findUnique.mockResolvedValue(
      { limite_disponivel: 800, limite: 1000 } as never
    )
    prismaMock.card.update.mockResolvedValue({} as never)
    prismaMock.cardInvoicePayment.delete.mockResolvedValue({} as never)

    const result = await CardInvoiceService.cancelInvoicePayment(
      USER_ID, CARD_ID, COMP_MES, COMP_ANO
    )

    expect(prismaMock.card.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { limite_disponivel: { decrement: 300 } } })
    )
    expect(prismaMock.cardInvoicePayment.delete).toHaveBeenCalledOnce()
    expect(result.amount_reverted).toBe(300)
  })

  it('lança erro 404 quando pagamento não encontrado', async () => {
    prismaMock.cardInvoicePayment.findFirst.mockResolvedValue(null)

    await expect(
      CardInvoiceService.cancelInvoicePayment(USER_ID, CARD_ID, COMP_MES, COMP_ANO)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando cancelamento deixaria limite negativo', async () => {
    const payment = makePayment({ amount_paid: 500 })
    prismaMock.cardInvoicePayment.findFirst.mockResolvedValue(payment as never)
    // limite_disponivel=100 - 500 = -400 (negativo)
    prismaMock.card.findUnique.mockResolvedValue(
      { limite_disponivel: 100, limite: 1000 } as never
    )

    await expect(
      CardInvoiceService.cancelInvoicePayment(USER_ID, CARD_ID, COMP_MES, COMP_ANO)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('negativo') })
  })
})
