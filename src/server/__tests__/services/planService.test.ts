import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { PlanService } from '@/server/services/planService'

const USER_ID = 1
const FUTURE_DATE = '2099-12-31'

async function seedPlan(overrides: Partial<typeof schema.plans.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.plans)
    .values({
      user_id: USER_ID,
      nome: 'Viagem Europa',
      meta: '10000',
      prazo: new Date(`${FUTURE_DATE}T12:00:00`),
      status: 'Iniciando',
      total_contribuido: '0',
      ...overrides,
    })
    .returning()
  return row
}

// ─── createPlan ───────────────────────────────────────────────────────────────

describe('PlanService.createPlan', () => {
  it('cria plano com sucesso e persiste no banco', async () => {
    const result = await PlanService.createPlan(
      { nome: 'Viagem Europa', meta: 10000, prazo: FUTURE_DATE },
      USER_ID
    )

    expect(result.nome).toBe('Viagem Europa')
    expect(result.status).toBe('Iniciando')
    expect(result.meta).toBe(10000)

    const rows = await db.select().from(schema.plans).where(eq(schema.plans.user_id, USER_ID))
    expect(rows).toHaveLength(1)
  })

  it('persiste taxa_anual personalizada quando informada', async () => {
    const result = await PlanService.createPlan(
      { nome: 'Carro', meta: 50000, prazo: FUTURE_DATE, taxa_anual: 12.5 },
      USER_ID
    )
    expect(result.taxa_anual).toBe(12.5)
  })

  it('lança erro 400 quando prazo está no passado', async () => {
    await expect(
      PlanService.createPlan({ nome: 'Viagem', meta: 1000, prazo: '2020-01-01' }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('futura') })
  })

  it('lança erro 400 quando meta é zero (tratado como campo ausente)', async () => {
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
    await seedPlan({ nome: 'Viagem Europa' })

    await expect(
      PlanService.createPlan({ nome: 'Viagem Europa', meta: 5000, prazo: FUTURE_DATE }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })
})

// ─── addContribution ──────────────────────────────────────────────────────────

describe('PlanService.addContribution', () => {
  it('adiciona contribuição e atualiza total e status para Em progresso', async () => {
    const plan = await seedPlan({ total_contribuido: '0', meta: '10000' })

    const result = await PlanService.addContribution(plan.id, { valor: 500 }, USER_ID)

    expect(result.new_total).toBe(500)
    expect(result.status).toBe('Em progresso')
    expect(result.progress_percentage).toBe(5)
    expect(result).toHaveProperty('aporte_mensal_necessario')

    const [updated] = await db.select().from(schema.plans).where(eq(schema.plans.id, plan.id))
    expect(Number(updated.total_contribuido)).toBe(500)
    expect(updated.status).toBe('Em progresso')
  })

  it('muda status para "Quase lá" quando progresso >= 80%', async () => {
    const plan = await seedPlan({ total_contribuido: '7500', meta: '10000' })

    const result = await PlanService.addContribution(plan.id, { valor: 500 }, USER_ID)

    expect(result.new_total).toBe(8000)
    expect(result.status).toBe('Quase lá')
  })

  it('muda status para "Concluído" quando progresso >= 100%', async () => {
    const plan = await seedPlan({ total_contribuido: '9500', meta: '10000' })

    const result = await PlanService.addContribution(plan.id, { valor: 500 }, USER_ID)

    expect(result.new_total).toBe(10000)
    expect(result.status).toBe('Concluído')
  })

  it('lança erro 400 quando plano já está Concluído', async () => {
    const plan = await seedPlan({ status: 'Concluído', total_contribuido: '10000' })

    await expect(
      PlanService.addContribution(plan.id, { valor: 100 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('concluído') })
  })

  it('lança erro 400 quando valor da contribuição é negativo', async () => {
    const plan = await seedPlan()
    await expect(
      PlanService.addContribution(plan.id, { valor: -100 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('positivo') })
  })

  it('lança erro 404 quando plano não existe', async () => {
    await expect(
      PlanService.addContribution(999, { valor: 100 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── removeContribution ───────────────────────────────────────────────────────

describe('PlanService.removeContribution', () => {
  it('remove contribuição e recalcula total do plano', async () => {
    const plan = await seedPlan({ total_contribuido: '1000', meta: '10000', status: 'Em progresso' })
    const [contribution] = await db
      .insert(schema.planContributions)
      .values({ plan_id: plan.id, user_id: USER_ID, valor: '500' })
      .returning()

    const result = await PlanService.removeContribution(contribution.id, USER_ID)

    expect(result.message).toContain('sucesso')
    expect(result.updated_plan.total_contribuido).toBe(500)

    const remaining = await db
      .select()
      .from(schema.planContributions)
      .where(eq(schema.planContributions.id, contribution.id))
    expect(remaining).toHaveLength(0)
  })

  it('lança erro 404 quando contribuição não existe', async () => {
    await expect(
      PlanService.removeContribution(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── deletePlan ───────────────────────────────────────────────────────────────

describe('PlanService.deletePlan', () => {
  it('deleta plano e suas contribuições', async () => {
    const plan = await seedPlan()
    await db.insert(schema.planContributions).values({ plan_id: plan.id, user_id: USER_ID, valor: '100' })

    const result = await PlanService.deletePlan(plan.id, USER_ID)

    expect(result.message).toContain('contribuições')

    const plans = await db.select().from(schema.plans).where(eq(schema.plans.id, plan.id))
    const contribs = await db
      .select()
      .from(schema.planContributions)
      .where(eq(schema.planContributions.plan_id, plan.id))
    expect(plans).toHaveLength(0)
    expect(contribs).toHaveLength(0)
  })

  it('lança erro 404 quando plano não existe', async () => {
    await expect(
      PlanService.deletePlan(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── simulateAporte ─────────────────────────────────────────────────────────────

describe('PlanService.simulateAporte', () => {
  it('calcula o aporte mensal usando a Selic quando não há taxa custom', async () => {
    const result = await PlanService.simulateAporte({ meta: 12000, prazo: FUTURE_DATE })

    expect(result.taxa_fonte).toBe('selic')
    expect(result.taxa_utilizada).toBe(10)
    expect(result.aporte_mensal).toBeGreaterThan(0)
    expect(result.meses_restantes).toBeGreaterThan(0)
  })

  it('usa a taxa personalizada quando informada', async () => {
    const result = await PlanService.simulateAporte({ meta: 12000, prazo: FUTURE_DATE, taxa_anual: 8 })
    expect(result.taxa_fonte).toBe('custom')
    expect(result.taxa_utilizada).toBe(8)
  })

  it('lança erro 400 quando meta não é positiva', async () => {
    await expect(
      PlanService.simulateAporte({ meta: 0, prazo: FUTURE_DATE })
    ).rejects.toMatchObject({ status: 400 })
  })
})
