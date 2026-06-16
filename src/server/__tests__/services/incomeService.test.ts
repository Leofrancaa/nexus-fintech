import { describe, it, expect } from 'vitest'
import { eq, and } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { IncomeService } from '@/server/services/incomeService'

const USER_ID = 1

async function seedIncome(overrides: Partial<typeof schema.incomes.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.incomes)
    .values({
      tipo: 'Salário',
      quantidade: '3000',
      data: new Date('2025-01-05T12:00:00'),
      fixo: false,
      user_id: USER_ID,
      ...overrides,
    })
    .returning()
  return row
}

describe('IncomeService.createIncome — receita simples', () => {
  it('cria receita não fixa sem replicação', async () => {
    const result = await IncomeService.createIncome({ tipo: 'Salário', quantidade: 3000 }, USER_ID)

    expect(Array.isArray(result)).toBe(false)
    expect((result as { quantidade: number }).quantidade).toBe(3000)

    const rows = await db.select().from(schema.incomes).where(eq(schema.incomes.user_id, USER_ID))
    expect(rows).toHaveLength(1)
  })

  it('passa category_id quando fornecido', async () => {
    await IncomeService.createIncome({ tipo: 'Freelance', quantidade: 500, category_id: 5 }, USER_ID)

    const [row] = await db.select().from(schema.incomes).where(eq(schema.incomes.user_id, USER_ID))
    expect(row.category_id).toBe(5)
  })
})

describe('IncomeService.createIncome — receita fixa', () => {
  it('cria receita base e replica para os meses restantes do ano', async () => {
    const result = await IncomeService.createIncome(
      { tipo: 'Aluguel', quantidade: 1200, fixo: true, data: '2025-01-05' },
      USER_ID
    )

    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(12)

    const rows = await db.select().from(schema.incomes).where(eq(schema.incomes.user_id, USER_ID))
    expect(rows).toHaveLength(12)
  })

  it('não replica quando a receita começa em dezembro — retorna array de 1 elemento', async () => {
    const result = await IncomeService.createIncome(
      { tipo: 'Aluguel', quantidade: 1200, fixo: true, data: '2025-12-01' },
      USER_ID
    )

    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(1)

    const rows = await db.select().from(schema.incomes).where(eq(schema.incomes.user_id, USER_ID))
    expect(rows).toHaveLength(1)
  })
})

describe('IncomeService.deleteIncome', () => {
  it('deleta receita simples', async () => {
    const income = await seedIncome({ fixo: false })

    const result = await IncomeService.deleteIncome(income.id, USER_ID)

    expect((result as { id: number }).id).toBe(income.id)
    const rows = await db.select().from(schema.incomes).where(eq(schema.incomes.id, income.id))
    expect(rows).toHaveLength(0)
  })

  it('deleta receita fixa e todas as do mesmo tipo', async () => {
    const income = await seedIncome({ fixo: true, tipo: 'Aluguel' })
    await seedIncome({ fixo: true, tipo: 'Aluguel', data: new Date('2025-02-05T12:00:00') })

    const result = await IncomeService.deleteIncome(income.id, USER_ID)

    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(2)

    const remaining = await db
      .select()
      .from(schema.incomes)
      .where(and(eq(schema.incomes.tipo, 'Aluguel'), eq(schema.incomes.fixo, true)))
    expect(remaining).toHaveLength(0)
  })

  it('lança erro 404 quando receita não existe', async () => {
    await expect(IncomeService.deleteIncome(999, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('IncomeService.updateIncome', () => {
  it('atualiza campos da receita', async () => {
    const income = await seedIncome()

    const result = await IncomeService.updateIncome(
      income.id,
      { tipo: 'Salário Novo', quantidade: 3500 },
      USER_ID
    )

    expect((result as { tipo: string }).tipo).toBe('Salário Novo')
    expect((result as { quantidade: number }).quantidade).toBe(3500)
  })

  it('lança erro 404 quando receita não existe', async () => {
    await expect(
      IncomeService.updateIncome(999, { tipo: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('atualiza mesmo com dados vazios (comportamento do service)', async () => {
    const income = await seedIncome()

    const result = await IncomeService.updateIncome(income.id, {}, USER_ID)

    expect((result as { id: number }).id).toBe(income.id)
  })
})
