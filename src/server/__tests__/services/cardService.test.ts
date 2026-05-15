import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { CardService } from '@/server/services/cardService'

const USER_ID = 1

function makeCardRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nome: 'Nubank',
    tipo: 'crédito',
    numero: '1234',
    cor: '#8A2BE2',
    limite: 1000,
    limite_disponivel: 1000,
    dia_vencimento: 10,
    dias_fechamento_antes: 5,
    user_id: USER_ID,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()

  prismaMock.$transaction.mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return fn(prismaMock)
    return Promise.all(fn as Promise<unknown>[])
  })
})

// ─── createCard ──────────────────────────────────────────────────────────────

describe('CardService.createCard', () => {
  it('cria cartão de crédito com sucesso', async () => {
    const record = makeCardRecord()
    prismaMock.card.create.mockResolvedValue(record as never)

    const result = await CardService.createCard(
      { nome: 'Nubank', tipo: 'crédito', numero: '1234', cor: '#8A2BE2', limite: 1000, dia_vencimento: 10 },
      USER_ID
    )

    expect(prismaMock.card.create).toHaveBeenCalledOnce()
    expect(result.nome).toBe('Nubank')
    expect(result.limite).toBe(1000)
  })

  it('cria cartão de débito com limite=0 e dia_vencimento=1', async () => {
    const record = makeCardRecord({ tipo: 'débito', limite: 0, limite_disponivel: 0, dia_vencimento: 1 })
    prismaMock.card.create.mockResolvedValue(record as never)

    await CardService.createCard(
      { nome: 'Conta', tipo: 'débito', numero: '5678', limite: 0 },
      USER_ID
    )

    const createCall = prismaMock.card.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.dia_vencimento).toBe(1)
    expect(createCall.data.dias_fechamento_antes).toBe(1)
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
    const existing = makeCardRecord()
    const updated = makeCardRecord({ nome: 'Nubank Gold' })
    prismaMock.card.findFirst.mockResolvedValue(existing as never)
    prismaMock.card.update.mockResolvedValue(updated as never)

    const result = await CardService.updateCard(1, { nome: 'Nubank Gold' }, USER_ID)

    expect(prismaMock.card.update).toHaveBeenCalledOnce()
    expect(result.nome).toBe('Nubank Gold')
  })

  it('lança erro 400 quando novo limite é menor que saldo em aberto', async () => {
    // saldo em aberto = 600, novo limite = 500 → inválido
    prismaMock.$queryRaw.mockResolvedValue([{ aberto: '600' }] as never)

    await expect(
      CardService.updateCard(1, { limite: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('saldo em aberto') })
  })

  it('atualiza limite quando novo valor é maior que saldo em aberto', async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ aberto: '300' }] as never)
    const updated = makeCardRecord({ limite: 1200, limite_disponivel: 900 })
    prismaMock.card.update.mockResolvedValue(updated as never)

    const result = await CardService.updateCard(1, { limite: 1200 }, USER_ID)

    expect(prismaMock.card.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ limite: 1200, limite_disponivel: 900 }),
      })
    )
    expect(result.limite).toBe(1200)
  })

  it('lança erro 400 quando número de atualização não tem 4 dígitos', async () => {
    await expect(
      CardService.updateCard(1, { numero: '12345' }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 404 quando cartão não encontrado (sem limite)', async () => {
    prismaMock.card.findFirst.mockResolvedValue(null)

    await expect(
      CardService.updateCard(999, { nome: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── deleteCard ──────────────────────────────────────────────────────────────

describe('CardService.deleteCard', () => {
  it('deleta cartão sem despesas diretamente', async () => {
    // Sem despesas no mês atual nem passadas
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }] as never) // hasCurrentMonthExpenses
      .mockResolvedValueOnce([{ count: BigInt(0) }] as never) // hasPastExpenses

    prismaMock.card.findFirst.mockResolvedValue(makeCardRecord() as never)
    prismaMock.card.delete.mockResolvedValue({} as never)

    const result = await CardService.deleteCard(1, USER_ID)

    expect(prismaMock.card.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(result.message).toContain('sucesso')
  })

  it('lança erro 400 quando há despesas no mês atual', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(3) }] as never) // tem despesas no mês

    await expect(
      CardService.deleteCard(1, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('mês atual') })
  })

  it('deleta cartão e despesas passadas em transação', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }] as never) // sem despesas no mês atual
      .mockResolvedValueOnce([{ count: BigInt(5) }] as never) // tem despesas passadas

    prismaMock.card.findFirst.mockResolvedValue(makeCardRecord() as never)
    prismaMock.expense.deleteMany.mockResolvedValue({ count: 5 } as never)
    prismaMock.cardInvoicePayment.deleteMany.mockResolvedValue({ count: 2 } as never)
    prismaMock.card.delete.mockResolvedValue({} as never)

    const result = await CardService.deleteCard(1, USER_ID)

    expect(prismaMock.expense.deleteMany).toHaveBeenCalledOnce()
    expect(prismaMock.card.delete).toHaveBeenCalledOnce()
    expect(result.message).toContain('despesas anteriores')
  })

  it('lança erro 404 quando cartão não existe e não há despesas', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ count: BigInt(0) }] as never)
      .mockResolvedValueOnce([{ count: BigInt(0) }] as never)

    prismaMock.card.findFirst.mockResolvedValue(null)

    await expect(
      CardService.deleteCard(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})
