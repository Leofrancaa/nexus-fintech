import { describe, it, expect } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { BalanceCarryoverService } from '@/server/services/balanceCarryoverService'

const USER_ID = 1

// Alvo: fevereiro 2025 → verifica saldo de janeiro 2025
const TARGET_MES = 2
const TARGET_ANO = 2025
const SRC_MES = 1
const SRC_ANO = 2025

const JAN = new Date('2025-01-15T12:00:00')
const FEB_START = new Date(2025, 1, 1)

async function seedIncome(quantidade: string, data: Date, tipo = 'salario') {
  await db.insert(schema.incomes).values({ user_id: USER_ID, tipo, quantidade, data })
}
async function seedExpense(quantidade: string, data: Date, tipo = 'compra') {
  await db.insert(schema.expenses).values({
    user_id: USER_ID,
    tipo,
    quantidade,
    data,
    metodo_pagamento: 'pix',
  })
}

describe('BalanceCarryoverService.check', () => {
  it('retorna saldo positivo e status pendente quando carryover não foi aplicado', async () => {
    await seedIncome('1000', JAN)
    await seedExpense('600', JAN)

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.saldo).toBe(400)
    expect(result.tipo).toBe('positivo')
    expect(result.status).toBe('pendente')
    expect(result.source_mes).toBe(SRC_MES)
    expect(result.source_ano).toBe(SRC_ANO)
  })

  it('retorna saldo negativo e status pendente quando há débito', async () => {
    await seedIncome('500', JAN)
    await seedExpense('800', JAN)

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.saldo).toBe(-300)
    expect(result.tipo).toBe('negativo')
    expect(result.status).toBe('pendente')
  })

  it('retorna status zerado quando saldo é exatamente zero', async () => {
    await seedIncome('500', JAN)
    await seedExpense('500', JAN)

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.saldo).toBe(0)
    expect(result.tipo).toBe('zerado')
    expect(result.status).toBe('sem_saldo')
  })

  it('retorna status aplicado quando já existe receita de carryover no mês alvo', async () => {
    await seedIncome('1000', JAN)
    await seedExpense('400', JAN)
    // Carryover já aplicado em fevereiro
    await seedIncome('600', FEB_START, 'saldo_anterior')

    const result = await BalanceCarryoverService.check(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.status).toBe('aplicado')
    expect(result.income_id).toBeDefined()
  })
})

describe('BalanceCarryoverService.apply', () => {
  it('cria receita de carryover quando saldo é positivo', async () => {
    await seedIncome('1000', JAN)
    await seedExpense('600', JAN)

    const result = await BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.status).toBe('aplicado')
    expect(result.income_id).toBeDefined()

    const carryovers = await db
      .select()
      .from(schema.incomes)
      .where(and(eq(schema.incomes.user_id, USER_ID), eq(schema.incomes.tipo, 'saldo_anterior')))
    expect(carryovers).toHaveLength(1)
    expect(Number(carryovers[0].quantidade)).toBe(400)
  })

  it('cria despesa de carryover quando saldo é negativo', async () => {
    await seedIncome('400', JAN)
    await seedExpense('700', JAN)

    const result = await BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)

    expect(result.status).toBe('aplicado')
    expect(result.expense_id).toBeDefined()

    const carryovers = await db
      .select()
      .from(schema.expenses)
      .where(and(eq(schema.expenses.user_id, USER_ID), eq(schema.expenses.tipo, 'debito_anterior')))
    expect(carryovers).toHaveLength(1)
    expect(Number(carryovers[0].quantidade)).toBe(300)
  })

  it('lança erro 409 quando carryover já foi aplicado', async () => {
    await seedIncome('1000', JAN)
    await seedExpense('600', JAN)
    await seedIncome('400', FEB_START, 'saldo_anterior')

    await expect(
      BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('lança erro 400 quando saldo é zero', async () => {
    await seedIncome('500', JAN)
    await seedExpense('500', JAN)

    await expect(
      BalanceCarryoverService.apply(USER_ID, TARGET_MES, TARGET_ANO)
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('BalanceCarryoverService.undo', () => {
  it('deleta a receita de carryover quando status é aplicado positivo', async () => {
    await seedIncome('1000', JAN)
    await seedExpense('600', JAN)
    await seedIncome('400', FEB_START, 'saldo_anterior')

    await BalanceCarryoverService.undo(USER_ID, TARGET_MES, TARGET_ANO)

    const remaining = await db
      .select()
      .from(schema.incomes)
      .where(eq(schema.incomes.tipo, 'saldo_anterior'))
    expect(remaining).toHaveLength(0)
  })

  it('deleta a despesa de carryover quando status é aplicado negativo', async () => {
    await seedIncome('400', JAN)
    await seedExpense('700', JAN)
    await seedExpense('300', FEB_START, 'debito_anterior')

    await BalanceCarryoverService.undo(USER_ID, TARGET_MES, TARGET_ANO)

    const remaining = await db
      .select()
      .from(schema.expenses)
      .where(eq(schema.expenses.tipo, 'debito_anterior'))
    expect(remaining).toHaveLength(0)
  })

  it('lança erro 404 quando não há carryover aplicado para desfazer', async () => {
    await seedIncome('1000', JAN)
    await seedExpense('600', JAN)

    await expect(
      BalanceCarryoverService.undo(USER_ID, TARGET_MES, TARGET_ANO)
    ).rejects.toMatchObject({ status: 404 })
  })
})
