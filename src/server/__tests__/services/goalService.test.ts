import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { GoalService } from '@/server/services/goalService'

const USER_ID = 1

async function seedGoal(overrides: Partial<typeof schema.goals.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.goals)
    .values({
      user_id: USER_ID,
      nome: 'Economizar para férias',
      valor_alvo: '5000',
      mes: 6,
      ano: 2025,
      ...overrides,
    })
    .returning()
  return row
}

// ─── createGoal ──────────────────────────────────────────────────────────────

describe('GoalService.createGoal', () => {
  it('cria meta com sucesso', async () => {
    const result = await GoalService.createGoal(
      { nome: 'Economizar para férias', valor_alvo: 5000, mes: 6, ano: 2025 },
      USER_ID
    )

    expect(result.nome).toBe('Economizar para férias')
    expect(result.valor_alvo).toBe(5000)

    const rows = await db.select().from(schema.goals).where(eq(schema.goals.user_id, USER_ID))
    expect(rows).toHaveLength(1)
  })

  it('lança erro 400 quando mês está fora do range 1-12', async () => {
    await expect(
      GoalService.createGoal({ nome: 'Meta', valor_alvo: 1000, mes: 13, ano: 2025 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('1 e 12') })

    await expect(
      GoalService.createGoal({ nome: 'Meta', valor_alvo: 1000, mes: 0, ano: 2025 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 400 quando valor_alvo é zero ou negativo', async () => {
    await expect(
      GoalService.createGoal({ nome: 'Meta', valor_alvo: 0, mes: 6, ano: 2025 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 409 quando já existe meta para o mesmo mês/ano', async () => {
    await seedGoal({ mes: 6, ano: 2025 })

    await expect(
      GoalService.createGoal({ nome: 'Outra meta', valor_alvo: 2000, mes: 6, ano: 2025 }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })
})

// ─── updateGoal ──────────────────────────────────────────────────────────────

describe('GoalService.updateGoal', () => {
  it('atualiza nome da meta com sucesso', async () => {
    const goal = await seedGoal()

    const result = await GoalService.updateGoal(goal.id, { nome: 'Novo nome' }, USER_ID)

    expect(result.nome).toBe('Novo nome')
  })

  it('lança erro 404 quando meta não existe', async () => {
    await expect(
      GoalService.updateGoal(999, { nome: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando novo mês é inválido', async () => {
    const goal = await seedGoal()

    await expect(
      GoalService.updateGoal(goal.id, { mes: 13 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('1 e 12') })
  })

  it('lança erro 409 quando novo mês/ano já existe em outra meta', async () => {
    const goal = await seedGoal({ mes: 7, ano: 2025 })
    await seedGoal({ mes: 6, ano: 2025 }) // conflito alvo

    await expect(
      GoalService.updateGoal(goal.id, { mes: 6, ano: 2025 }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('lança erro 400 quando valor_alvo é negativo', async () => {
    const goal = await seedGoal()

    await expect(
      GoalService.updateGoal(goal.id, { valor_alvo: -500 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })
})

// ─── deleteGoal ───────────────────────────────────────────────────────────────

describe('GoalService.deleteGoal', () => {
  it('deleta meta com sucesso', async () => {
    const goal = await seedGoal()

    const result = await GoalService.deleteGoal(goal.id, USER_ID)

    expect(result.message).toContain('sucesso')
    const rows = await db.select().from(schema.goals).where(eq(schema.goals.id, goal.id))
    expect(rows).toHaveLength(0)
  })

  it('lança erro 404 quando meta não existe', async () => {
    await expect(
      GoalService.deleteGoal(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── getGoalStats ─────────────────────────────────────────────────────────────

describe('GoalService.getGoalStats', () => {
  it('calcula stats corretamente com metas atingidas e em progresso', async () => {
    // Meta 1: alvo 1000, com 1000 de receita no mês → 100% atingida
    await seedGoal({ nome: 'Meta1', valor_alvo: '1000', mes: 6, ano: 2025 })
    // Meta 2: alvo 2000, com 500 de receita → 25% em progresso
    await seedGoal({ nome: 'Meta2', valor_alvo: '2000', mes: 7, ano: 2025 })

    await db.insert(schema.incomes).values([
      { user_id: USER_ID, tipo: 'salario', quantidade: '1000', data: new Date('2025-06-15T12:00:00') },
      { user_id: USER_ID, tipo: 'salario', quantidade: '500', data: new Date('2025-07-15T12:00:00') },
    ])

    const result = await GoalService.getGoalStats(USER_ID)

    expect(result.total_goals).toBe(2)
    expect(result.achieved_goals).toBe(1)
    expect(result.in_progress_goals).toBe(1)
    expect(result.total_target).toBe(3000)
    expect(result.total_achieved).toBe(1500)
  })

  it('retorna zeros quando não há metas', async () => {
    const result = await GoalService.getGoalStats(USER_ID)

    expect(result.total_goals).toBe(0)
    expect(result.achieved_goals).toBe(0)
  })
})
