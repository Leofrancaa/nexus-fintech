import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { PlanService } from '@/server/services/planService'

const USER_ID = 1

// Prazo sempre no futuro
const FUTURE_DATE = '2099-12-31'

function makePlanRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: USER_ID,
    nome: 'Viagem Europa',
    descricao: null,
    meta: 10000,
    prazo: new Date(`${FUTURE_DATE}T12:00:00`),
    status: 'Iniciando',
    total_contribuido: 0,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

function makeContributionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    plan_id: 1,
    user_id: USER_ID,
    valor: 500,
    created_at: new Date(),
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

// ─── createPlan ───────────────────────────────────────────────────────────────

describe('PlanService.createPlan', () => {
  it('cria plano com sucesso', async () => {
    prismaMock.plan.findFirst.mockResolvedValue(null) // sem duplicata
    prismaMock.plan.create.mockResolvedValue(makePlanRecord() as never)

    const result = await PlanService.createPlan(
      { nome: 'Viagem Europa', meta: 10000, prazo: FUTURE_DATE },
      USER_ID
    )

    expect(prismaMock.plan.create).toHaveBeenCalledOnce()
    expect(result.nome).toBe('Viagem Europa')
    expect(result.status).toBe('Iniciando')
  })

  it('lança erro 400 quando prazo está no passado', async () => {
    await expect(
      PlanService.createPlan({ nome: 'Viagem', meta: 1000, prazo: '2020-01-01' }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('futura') })
  })

  it('lança erro 400 quando meta é zero (tratado como campo ausente)', async () => {
    // meta=0 → !meta === true → cai na validação de campos obrigatórios
    await expect(
      PlanService.createPlan({ nome: 'Viagem', meta: 0, prazo: FUTURE_DATE }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 400 quando meta é negativa', async () => {
    await expect(
      PlanService.createPlan({ nome: 'Viagem', meta: -500, prazo: FUTURE_DATE }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('positivo') })
  })

  it('lança erro 400 quando prazo não está no formato YYYY-MM-DD', async () => {
    await expect(
      PlanService.createPlan({ nome: 'Viagem', meta: 1000, prazo: '31/12/2099' }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('YYYY-MM-DD') })
  })

  it('lança erro 409 quando já existe plano com o mesmo nome', async () => {
    prismaMock.plan.findFirst.mockResolvedValue(makePlanRecord() as never)

    await expect(
      PlanService.createPlan({ nome: 'Viagem Europa', meta: 5000, prazo: FUTURE_DATE }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })
})

// ─── addContribution ──────────────────────────────────────────────────────────

describe('PlanService.addContribution', () => {
  it('adiciona contribuição e atualiza total e status para Em progresso', async () => {
    const plan = makePlanRecord({ total_contribuido: 0, meta: 10000, status: 'Iniciando' })
    prismaMock.plan.findFirst.mockResolvedValue(plan as never)
    prismaMock.planContribution.create.mockResolvedValue(makeContributionRecord({ valor: 500 }) as never)
    prismaMock.plan.update.mockResolvedValue(makePlanRecord({ total_contribuido: 500, status: 'Em progresso' }) as never)

    const result = await PlanService.addContribution(1, { valor: 500 }, USER_ID)

    expect(result.new_total).toBe(500)
    expect(result.status).toBe('Em progresso')
    expect(result.progress_percentage).toBe(5)
    expect(prismaMock.planContribution.create).toHaveBeenCalledOnce()
    expect(prismaMock.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ total_contribuido: 500, status: 'Em progresso' }) })
    )
  })

  it('muda status para "Quase lá" quando progresso >= 80%', async () => {
    const plan = makePlanRecord({ total_contribuido: 7500, meta: 10000 })
    prismaMock.plan.findFirst.mockResolvedValue(plan as never)
    prismaMock.planContribution.create.mockResolvedValue(makeContributionRecord({ valor: 500 }) as never)
    prismaMock.plan.update.mockResolvedValue({} as never)

    const result = await PlanService.addContribution(1, { valor: 500 }, USER_ID)

    expect(result.new_total).toBe(8000)
    expect(result.status).toBe('Quase lá')
  })

  it('muda status para "Concluído" quando progresso >= 100%', async () => {
    const plan = makePlanRecord({ total_contribuido: 9500, meta: 10000 })
    prismaMock.plan.findFirst.mockResolvedValue(plan as never)
    prismaMock.planContribution.create.mockResolvedValue(makeContributionRecord({ valor: 500 }) as never)
    prismaMock.plan.update.mockResolvedValue({} as never)

    const result = await PlanService.addContribution(1, { valor: 500 }, USER_ID)

    expect(result.new_total).toBe(10000)
    expect(result.status).toBe('Concluído')
  })

  it('lança erro 400 quando plano já está Concluído', async () => {
    prismaMock.plan.findFirst.mockResolvedValue(
      makePlanRecord({ status: 'Concluído', total_contribuido: 10000 }) as never
    )

    await expect(
      PlanService.addContribution(1, { valor: 100 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('concluído') })
  })

  it('lança erro 400 quando valor da contribuição é negativo', async () => {
    await expect(
      PlanService.addContribution(1, { valor: -100 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('positivo') })
  })

  it('lança erro 404 quando plano não existe', async () => {
    prismaMock.plan.findFirst.mockResolvedValue(null)

    await expect(
      PlanService.addContribution(999, { valor: 100 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── removeContribution ───────────────────────────────────────────────────────

describe('PlanService.removeContribution', () => {
  it('remove contribuição e recalcula total do plano', async () => {
    const contribution = makeContributionRecord({ valor: 500 })
    const plan = makePlanRecord({ total_contribuido: 1000, meta: 10000 })

    prismaMock.planContribution.findFirst.mockResolvedValue(contribution as never)
    prismaMock.plan.findFirst.mockResolvedValue(plan as never)
    prismaMock.planContribution.delete.mockResolvedValue({} as never)
    prismaMock.plan.update.mockResolvedValue(makePlanRecord({ total_contribuido: 500 }) as never)

    const result = await PlanService.removeContribution(1, USER_ID)

    expect(prismaMock.planContribution.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(prismaMock.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ total_contribuido: 500 }) })
    )
    expect(result.message).toContain('sucesso')
  })

  it('lança erro 404 quando contribuição não existe', async () => {
    prismaMock.planContribution.findFirst.mockResolvedValue(null)

    await expect(
      PlanService.removeContribution(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── deletePlan ───────────────────────────────────────────────────────────────

describe('PlanService.deletePlan', () => {
  it('deleta plano e suas contribuições', async () => {
    prismaMock.plan.findFirst.mockResolvedValue(makePlanRecord() as never)
    prismaMock.planContribution.deleteMany.mockResolvedValue({ count: 3 } as never)
    prismaMock.plan.delete.mockResolvedValue({} as never)

    const result = await PlanService.deletePlan(1, USER_ID)

    expect(prismaMock.planContribution.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ plan_id: 1 }) })
    )
    expect(prismaMock.plan.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(result.message).toContain('contribuições')
  })

  it('lança erro 404 quando plano não existe', async () => {
    prismaMock.plan.findFirst.mockResolvedValue(null)

    await expect(
      PlanService.deletePlan(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})
