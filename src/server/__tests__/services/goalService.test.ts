import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { GoalService } from '@/server/services/goalService'

const USER_ID = 1

function makeGoalRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: USER_ID,
    nome: 'Economizar para férias',
    valor_alvo: 5000,
    mes: 6,
    ano: 2025,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()
})

// ─── createGoal ──────────────────────────────────────────────────────────────

describe('GoalService.createGoal', () => {
  it('cria meta com sucesso', async () => {
    prismaMock.goal.findFirst.mockResolvedValue(null)
    prismaMock.goal.create.mockResolvedValue(makeGoalRecord() as never)

    const result = await GoalService.createGoal(
      { nome: 'Economizar para férias', valor_alvo: 5000, mes: 6, ano: 2025 },
      USER_ID
    )

    expect(prismaMock.goal.create).toHaveBeenCalledOnce()
    expect(result.nome).toBe('Economizar para férias')
    expect(result.valor_alvo).toBe(5000)
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
    prismaMock.goal.findFirst.mockResolvedValue(makeGoalRecord() as never)

    await expect(
      GoalService.createGoal({ nome: 'Outra meta', valor_alvo: 2000, mes: 6, ano: 2025 }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })
})

// ─── updateGoal ──────────────────────────────────────────────────────────────

describe('GoalService.updateGoal', () => {
  it('atualiza nome da meta com sucesso', async () => {
    const existing = makeGoalRecord()
    const updated = makeGoalRecord({ nome: 'Novo nome' })
    prismaMock.goal.findFirst.mockResolvedValue(existing as never)
    prismaMock.goal.update.mockResolvedValue(updated as never)

    const result = await GoalService.updateGoal(1, { nome: 'Novo nome' }, USER_ID)

    expect(prismaMock.goal.update).toHaveBeenCalledOnce()
    expect(result.nome).toBe('Novo nome')
  })

  it('lança erro 404 quando meta não existe', async () => {
    prismaMock.goal.findFirst.mockResolvedValue(null)

    await expect(
      GoalService.updateGoal(999, { nome: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando novo mês é inválido', async () => {
    prismaMock.goal.findFirst.mockResolvedValue(makeGoalRecord() as never)

    await expect(
      GoalService.updateGoal(1, { mes: 13 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('1 e 12') })
  })

  it('lança erro 409 quando novo mês/ano já existe em outra meta', async () => {
    const existing = makeGoalRecord()
    prismaMock.goal.findFirst
      .mockResolvedValueOnce(existing as never)  // getGoalById
      .mockResolvedValueOnce(makeGoalRecord({ id: 2 }) as never) // conflito

    await expect(
      GoalService.updateGoal(1, { mes: 6, ano: 2025 }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('lança erro 400 quando valor_alvo é negativo', async () => {
    prismaMock.goal.findFirst.mockResolvedValue(makeGoalRecord() as never)

    await expect(
      GoalService.updateGoal(1, { valor_alvo: -500 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })
})

// ─── deleteGoal ───────────────────────────────────────────────────────────────

describe('GoalService.deleteGoal', () => {
  it('deleta meta com sucesso', async () => {
    prismaMock.goal.findFirst.mockResolvedValue(makeGoalRecord() as never)
    prismaMock.goal.delete.mockResolvedValue({} as never)

    const result = await GoalService.deleteGoal(1, USER_ID)

    expect(prismaMock.goal.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(result.message).toContain('sucesso')
  })

  it('lança erro 404 quando meta não existe', async () => {
    prismaMock.goal.findFirst.mockResolvedValue(null)

    await expect(
      GoalService.deleteGoal(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── getGoalStats ─────────────────────────────────────────────────────────────

describe('GoalService.getGoalStats', () => {
  it('calcula stats corretamente com metas atingidas e em progresso', async () => {
    // Mock getGoalsByUser (que usa goal.findMany + $queryRaw por goal)
    prismaMock.goal.findMany.mockResolvedValue([
      makeGoalRecord({ valor_alvo: 1000 }),
      makeGoalRecord({ id: 2, valor_alvo: 2000 }),
    ] as never)

    // $queryRaw retorna receitas do mês para cada meta
    prismaMock.$queryRaw
      .mockResolvedValueOnce([{ valor_atual: '1000' }] as never) // meta 1: 100% atingida
      .mockResolvedValueOnce([{ valor_atual: '500' }] as never)  // meta 2: 25% em progresso

    const result = await GoalService.getGoalStats(USER_ID)

    expect(result.total_goals).toBe(2)
    expect(result.achieved_goals).toBe(1)
    expect(result.in_progress_goals).toBe(1)
    expect(result.total_target).toBe(3000)
    expect(result.total_achieved).toBe(1500)
  })

  it('retorna zeros quando não há metas', async () => {
    prismaMock.goal.findMany.mockResolvedValue([] as never)

    const result = await GoalService.getGoalStats(USER_ID)

    expect(result.total_goals).toBe(0)
    expect(result.achieved_goals).toBe(0)
  })
})
