import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { CareerService } from '@/server/services/careerService'

const USER_ID = 1

describe('CareerService.ensureSeeded', () => {
  it('cria o perfil e os marcos padrão no primeiro acesso', async () => {
    await CareerService.ensureSeeded(USER_ID)

    const profile = await CareerService.getProfile(USER_ID)
    expect(profile).not.toBeNull()
    expect(profile?.north_star).toBeTruthy()
    expect(profile?.principles.length).toBeGreaterThan(0)

    const milestones = await CareerService.getMilestones(USER_ID)
    expect(milestones.length).toBeGreaterThan(0)
    // cobre os três horizontes
    expect(milestones.some((m) => m.horizon === '0-6m')).toBe(true)
    expect(milestones.some((m) => m.horizon === '6-18m')).toBe(true)
    expect(milestones.some((m) => m.horizon === '18-36m')).toBe(true)
  })

  it('é idempotente (não duplica ao chamar de novo)', async () => {
    await CareerService.ensureSeeded(USER_ID)
    const first = await CareerService.getMilestones(USER_ID)
    await CareerService.ensureSeeded(USER_ID)
    const second = await CareerService.getMilestones(USER_ID)
    expect(second.length).toBe(first.length)
  })
})

describe('CareerService.updateProfile', () => {
  it('faz upsert do perfil', async () => {
    const result = await CareerService.updateProfile(USER_ID, {
      north_star: 'Novo norte',
      track: 'technical',
      principles: ['p1', 'p2'],
    })
    expect(result.north_star).toBe('Novo norte')
    expect(result.track).toBe('technical')
    expect(result.principles).toEqual(['p1', 'p2'])
  })

  it('rejeita trilha inválida', async () => {
    await expect(
      // @ts-expect-error trilha inválida proposital
      CareerService.updateProfile(USER_ID, { track: 'outro' })
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('CareerService milestones CRUD', () => {
  it('cria marco com sucesso', async () => {
    const m = await CareerService.createMilestone(USER_ID, {
      title: 'Aprender TensorRT',
      horizon: '6-18m',
    })
    expect(m.title).toBe('Aprender TensorRT')
    expect(m.status).toBe('planned')
  })

  it('rejeita marco sem título', async () => {
    await expect(
      CareerService.createMilestone(USER_ID, { title: '', horizon: '0-6m' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejeita horizonte inválido', async () => {
    await expect(
      // @ts-expect-error horizonte inválido proposital
      CareerService.createMilestone(USER_ID, { title: 'X', horizon: '99m' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('atualiza status do marco', async () => {
    const m = await CareerService.createMilestone(USER_ID, { title: 'X', horizon: '0-6m' })
    const updated = await CareerService.updateMilestone(m.id, USER_ID, { status: 'done' })
    expect(updated.status).toBe('done')
  })

  it('rejeita status inválido', async () => {
    const m = await CareerService.createMilestone(USER_ID, { title: 'X', horizon: '0-6m' })
    await expect(
      // @ts-expect-error status inválido proposital
      CareerService.updateMilestone(m.id, USER_ID, { status: 'foo' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('404 ao atualizar marco inexistente', async () => {
    await expect(
      CareerService.updateMilestone(999, USER_ID, { status: 'done' })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('deleta marco', async () => {
    const m = await CareerService.createMilestone(USER_ID, { title: 'X', horizon: '0-6m' })
    await CareerService.deleteMilestone(m.id, USER_ID)
    const rows = await db
      .select()
      .from(schema.careerMilestones)
      .where(eq(schema.careerMilestones.id, m.id))
    expect(rows).toHaveLength(0)
  })

  it('404 ao deletar marco inexistente', async () => {
    await expect(CareerService.deleteMilestone(999, USER_ID)).rejects.toMatchObject({
      status: 404,
    })
  })
})

describe('CareerService.getProgress', () => {
  it('calcula a % de marcos concluídos', async () => {
    const a = await CareerService.createMilestone(USER_ID, { title: 'A', horizon: '0-6m' })
    await CareerService.createMilestone(USER_ID, { title: 'B', horizon: '0-6m' })
    expect(await CareerService.getProgress(USER_ID)).toBe(0)
    await CareerService.updateMilestone(a.id, USER_ID, { status: 'done' })
    expect(await CareerService.getProgress(USER_ID)).toBe(50)
  })

  it('retorna 0 quando não há marcos', async () => {
    expect(await CareerService.getProgress(USER_ID)).toBe(0)
  })
})
