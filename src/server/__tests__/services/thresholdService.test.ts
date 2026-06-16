import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { ThresholdService } from '@/server/services/thresholdService'

const USER_ID = 1

async function seedCategory(overrides: Partial<typeof schema.categories.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.categories)
    .values({ nome: 'Alimentação', cor: '#FF6B6B', tipo: 'despesa', user_id: USER_ID, ...overrides })
    .returning()
  return row
}

async function seedThreshold(categoryId: number, valor: string) {
  const [row] = await db
    .insert(schema.thresholds)
    .values({ user_id: USER_ID, category_id: categoryId, valor })
    .returning()
  return row
}

// ─── createOrUpdateThreshold ─────────────────────────────────────────────────

describe('ThresholdService.createOrUpdateThreshold', () => {
  it('cria threshold com sucesso (upsert)', async () => {
    const cat = await seedCategory()

    const result = await ThresholdService.createOrUpdateThreshold(
      { category_id: cat.id, valor: 500 },
      USER_ID
    )

    expect(result.valor).toBe(500)
    const rows = await db.select().from(schema.thresholds).where(eq(schema.thresholds.category_id, cat.id))
    expect(rows).toHaveLength(1)
  })

  it('lança erro 400 quando valor é zero ou negativo', async () => {
    await expect(
      ThresholdService.createOrUpdateThreshold({ category_id: 1, valor: 0 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 404 quando categoria não existe', async () => {
    await expect(
      ThresholdService.createOrUpdateThreshold({ category_id: 999, valor: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando categoria é do tipo receita', async () => {
    const cat = await seedCategory({ tipo: 'receita', cor: '#00FF00' })

    await expect(
      ThresholdService.createOrUpdateThreshold({ category_id: cat.id, valor: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('despesa') })
  })

  it('atualiza threshold existente (upsert com update)', async () => {
    const cat = await seedCategory()
    await seedThreshold(cat.id, '500')

    const result = await ThresholdService.createOrUpdateThreshold(
      { category_id: cat.id, valor: 800 },
      USER_ID
    )

    expect(result.valor).toBe(800)
    const rows = await db.select().from(schema.thresholds).where(eq(schema.thresholds.category_id, cat.id))
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].valor)).toBe(800)
  })
})

// ─── updateThreshold ──────────────────────────────────────────────────────────

describe('ThresholdService.updateThreshold', () => {
  it('atualiza valor com sucesso', async () => {
    const cat = await seedCategory()
    const t = await seedThreshold(cat.id, '500')

    const result = await ThresholdService.updateThreshold(t.id, { valor: 700 }, USER_ID)

    expect(result.valor).toBe(700)
  })

  it('lança erro 404 quando threshold não existe', async () => {
    await expect(
      ThresholdService.updateThreshold(999, { valor: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando novo valor é negativo', async () => {
    const cat = await seedCategory()
    const t = await seedThreshold(cat.id, '500')

    await expect(
      ThresholdService.updateThreshold(t.id, { valor: -100 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })
})

// ─── deleteThreshold ──────────────────────────────────────────────────────────

describe('ThresholdService.deleteThreshold', () => {
  it('deleta threshold com sucesso', async () => {
    const cat = await seedCategory()
    const t = await seedThreshold(cat.id, '500')

    const result = await ThresholdService.deleteThreshold(t.id, USER_ID)

    expect(result.message).toContain('sucesso')
    const rows = await db.select().from(schema.thresholds).where(eq(schema.thresholds.id, t.id))
    expect(rows).toHaveLength(0)
  })

  it('lança erro 404 quando threshold não existe', async () => {
    await expect(
      ThresholdService.deleteThreshold(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── checkThresholdViolation ──────────────────────────────────────────────────

describe('ThresholdService.checkThresholdViolation', () => {
  async function seedExpense(categoryId: number, quantidade: string, data: Date) {
    await db.insert(schema.expenses).values({
      metodo_pagamento: 'pix',
      tipo: 'compra',
      quantidade,
      data,
      user_id: USER_ID,
      category_id: categoryId,
    })
  }

  it('retorna would_violate=false quando não há threshold configurado', async () => {
    const result = await ThresholdService.checkThresholdViolation(USER_ID, 1, 100)
    expect(result.would_violate).toBe(false)
  })

  it('retorna would_violate=false quando gasto + valor fica dentro do limite', async () => {
    const cat = await seedCategory()
    await seedThreshold(cat.id, '500')
    await seedExpense(cat.id, '200', new Date('2025-01-10T12:00:00'))

    const result = await ThresholdService.checkThresholdViolation(USER_ID, cat.id, 100, 1, 2025)

    expect(result.would_violate).toBe(false)
    expect(result.remaining).toBe(300)
    expect(result.new_total).toBe(300)
  })

  it('retorna would_violate=true quando gasto + valor ultrapassa o limite', async () => {
    const cat = await seedCategory()
    await seedThreshold(cat.id, '500')
    await seedExpense(cat.id, '450', new Date('2025-01-10T12:00:00'))

    const result = await ThresholdService.checkThresholdViolation(USER_ID, cat.id, 100, 1, 2025)

    expect(result.would_violate).toBe(true)
    expect(result.new_total).toBe(550)
    expect(result.threshold_value).toBe(500)
  })

  it('retorna would_violate=true quando já está acima do limite', async () => {
    const cat = await seedCategory()
    await seedThreshold(cat.id, '300')
    await seedExpense(cat.id, '400', new Date('2025-01-10T12:00:00'))

    const result = await ThresholdService.checkThresholdViolation(USER_ID, cat.id, 1, 1, 2025)

    expect(result.would_violate).toBe(true)
  })
})
