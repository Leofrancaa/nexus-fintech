import { describe, it, expect } from 'vitest'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { PersonalService } from '@/server/services/personalService'

const USER_ID = 1

describe('PersonalService CRUD', () => {
  it('cria meta com status padrão planned', async () => {
    const goal = await PersonalService.createGoal(USER_ID, { title: 'Comprar casa' })
    expect(goal.title).toBe('Comprar casa')
    expect(goal.status).toBe('planned')
    expect(goal.target_date).toBeNull()
  })

  it('cria meta com data-alvo (retornada como YYYY-MM-DD)', async () => {
    const goal = await PersonalService.createGoal(USER_ID, {
      title: 'Viagem',
      target_date: '2027-01-15',
    })
    expect(goal.target_date).toBe('2027-01-15')
  })

  it('rejeita meta sem título', async () => {
    await expect(PersonalService.createGoal(USER_ID, { title: '' })).rejects.toMatchObject({
      status: 400,
    })
  })

  it('rejeita data-alvo em formato inválido', async () => {
    await expect(
      PersonalService.createGoal(USER_ID, { title: 'X', target_date: '15/01/2027' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejeita status inválido', async () => {
    await expect(
      // @ts-expect-error status inválido proposital
      PersonalService.createGoal(USER_ID, { title: 'X', status: 'foo' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('atualiza status da meta', async () => {
    const goal = await PersonalService.createGoal(USER_ID, { title: 'X' })
    const updated = await PersonalService.updateGoal(goal.id, USER_ID, { status: 'done' })
    expect(updated.status).toBe('done')
  })

  it('404 ao atualizar meta inexistente', async () => {
    await expect(
      PersonalService.updateGoal(999, USER_ID, { status: 'done' })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('deleta meta', async () => {
    const goal = await PersonalService.createGoal(USER_ID, { title: 'X' })
    await PersonalService.deleteGoal(goal.id, USER_ID)
    const rows = await db
      .select()
      .from(schema.personalGoals)
      .where(eq(schema.personalGoals.id, goal.id))
    expect(rows).toHaveLength(0)
  })

  it('404 ao deletar meta inexistente', async () => {
    await expect(PersonalService.deleteGoal(999, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})
