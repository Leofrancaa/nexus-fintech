import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { BalanceCarryoverService } from '@/server/services/balanceCarryoverService'

const USER_ID = 1

// Alvo: fevereiro 2025 → verifica saldo de janeiro 2025
const TARGET_MES = 2
const TARGET_ANO = 2025
const SRC_MES = 1
const SRC_ANO = 2025

function rawTotal(value: number) {
  return [{ total: String(value) }]
}

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()
})

describe('BalanceCarryoverService.check', () => {
  it('retorna saldo positivo e status pendente quando carryover não foi aplicado', async () => {
    // receitas jan = 1000, despesas jan = 600 → saldo = 400
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(1000) as never) // receitas
      .mockResolvedValueOnce(rawTotal(600) as never)  // despesas

    prismaMock.income.findFirst.mockResolvedValue(null) // ainda não aplicado

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.saldo).toBe(400)
    expect(result.tipo).toBe('positivo')
    expect(result.status).toBe('pendente')
    expect(result.source_mes).toBe(SRC_MES)
    expect(result.source_ano).toBe(SRC_ANO)
  })

  it('retorna saldo negativo e status pendente quando há débito', async () => {
    // receitas jan = 500, despesas jan = 800 → saldo = -300
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(500) as never)
      .mockResolvedValueOnce(rawTotal(800) as never)

    prismaMock.expense.findFirst.mockResolvedValue(null)

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.saldo).toBe(-300)
    expect(result.tipo).toBe('negativo')
    expect(result.status).toBe('pendente')
  })

  it('retorna status zerado quando saldo é exatamente zero', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(500) as never)
      .mockResolvedValueOnce(rawTotal(500) as never)

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.saldo).toBe(0)
    expect(result.tipo).toBe('zerado')
    expect(result.status).toBe('sem_saldo')
  })

  it('retorna status aplicado quando já existe receita de carryover no mês alvo', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(1000) as never)
      .mockResolvedValueOnce(rawTotal(400) as never)

    // Receita de carryover já existe
    prismaMock.income.findFirst.mockResolvedValue({ id: 99 } as never)

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.status).toBe('aplicado')
    expect(result.income_id).toBe(99)
  })
})

describe('BalanceCarryoverService.apply', () => {
  it('cria receita de carryover quando saldo é positivo', async () => {
    // check retorna saldo positivo pendente
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(1000) as never) // receitas (check)
      .mockResolvedValueOnce(rawTotal(600) as never)  // despesas (check)
    prismaMock.income.findFirst.mockResolvedValue(null)

    // getOrCreateCategory
    prismaMock.category.findFirst.mockResolvedValue({ id: 5 } as never)
    // criar receita
    prismaMock.income.create.mockResolvedValue({ id: 10 } as never)

    const result = await BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)

    expect(prismaMock.income.create).toHaveBeenCalledOnce()
    expect(result.status).toBe('aplicado')
    expect(result.income_id).toBe(10)
  })

  it('cria despesa de carryover quando saldo é negativo', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(400) as never)
      .mockResolvedValueOnce(rawTotal(700) as never)
    prismaMock.expense.findFirst.mockResolvedValue(null)

    prismaMock.category.findFirst.mockResolvedValue({ id: 6 } as never)
    prismaMock.expense.create.mockResolvedValue({ id: 20 } as never)

    const result = await BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)

    expect(prismaMock.expense.create).toHaveBeenCalledOnce()
    expect(result.status).toBe('aplicado')
    expect(result.expense_id).toBe(20)
  })

  it('lança erro 409 quando carryover já foi aplicado', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(1000) as never)
      .mockResolvedValueOnce(rawTotal(600) as never)
    prismaMock.income.findFirst.mockResolvedValue({ id: 99 } as never) // já aplicado

    await expect(
      BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('lança erro 400 quando saldo é zero', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(500) as never)
      .mockResolvedValueOnce(rawTotal(500) as never)

    await expect(
      BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('BalanceCarryoverService.undo', () => {
  it('deleta a receita de carryover quando status é aplicado positivo', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(1000) as never)
      .mockResolvedValueOnce(rawTotal(600) as never)
    prismaMock.income.findFirst.mockResolvedValue({ id: 99 } as never)
    prismaMock.income.delete.mockResolvedValue({} as never)

    await BalanceCarryoverService.undo(USER_ID, TARGET_MES, TARGET_ANO)

    expect(prismaMock.income.delete).toHaveBeenCalledWith({ where: { id: 99 } })
  })

  it('deleta a despesa de carryover quando status é aplicado negativo', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(300) as never)
      .mockResolvedValueOnce(rawTotal(800) as never)
    prismaMock.expense.findFirst.mockResolvedValue({ id: 88 } as never)
    prismaMock.expense.delete.mockResolvedValue({} as never)

    await BalanceCarryoverService.undo(USER_ID, TARGET_MES, TARGET_ANO)

    expect(prismaMock.expense.delete).toHaveBeenCalledWith({ where: { id: 88 } })
  })

  it('lança erro 404 quando não há carryover aplicado para desfazer', async () => {
    prismaMock.$queryRaw
      .mockResolvedValueOnce(rawTotal(1000) as never)
      .mockResolvedValueOnce(rawTotal(600) as never)
    prismaMock.income.findFirst.mockResolvedValue(null) // não aplicado

    await expect(
      BalanceCarryoverService.undo(USER_ID, TARGET_MES, TARGET_ANO)
    ).rejects.toMatchObject({ status: 404 })
  })
})
