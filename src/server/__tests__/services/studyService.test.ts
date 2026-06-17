import { describe, it, expect } from 'vitest'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { StudyService } from '@/server/services/studyService'

const USER_ID = 1

describe('StudyService — sem seed padrão', () => {
  it('começa vazio (cada usuário cria a própria trilha)', async () => {
    const items = await StudyService.getItems(USER_ID)
    expect(items).toHaveLength(0)
  })
})

describe('StudyService CRUD', () => {
  it('cria item com progresso 0 e status planned por padrão', async () => {
    const item = await StudyService.createItem(USER_ID, { title: 'PyTorch' })
    expect(item.progress).toBe(0)
    expect(item.status).toBe('planned')
  })

  it('rejeita item sem título', async () => {
    await expect(StudyService.createItem(USER_ID, { title: '' })).rejects.toMatchObject({
      status: 400,
    })
  })

  it('rejeita categoria inválida', async () => {
    await expect(
      // @ts-expect-error categoria inválida proposital
      StudyService.createItem(USER_ID, { title: 'X', category: 'video' })
    ).rejects.toMatchObject({ status: 400 })
  })

  it('sincroniza status ao atualizar progresso', async () => {
    const item = await StudyService.createItem(USER_ID, { title: 'X' })

    const mid = await StudyService.updateItem(item.id, USER_ID, { progress: 50 })
    expect(mid.progress).toBe(50)
    expect(mid.status).toBe('in_progress')

    const done = await StudyService.updateItem(item.id, USER_ID, { progress: 100 })
    expect(done.status).toBe('done')
  })

  it('limita o progresso entre 0 e 100', async () => {
    const item = await StudyService.createItem(USER_ID, { title: 'X' })
    const over = await StudyService.updateItem(item.id, USER_ID, { progress: 150 })
    expect(over.progress).toBe(100)
  })

  it('404 ao atualizar item inexistente', async () => {
    await expect(
      StudyService.updateItem(999, USER_ID, { progress: 10 })
    ).rejects.toMatchObject({ status: 404 })
  })

  it('deleta item', async () => {
    const item = await StudyService.createItem(USER_ID, { title: 'X' })
    await StudyService.deleteItem(item.id, USER_ID)
    const rows = await db.select().from(schema.studyItems).where(eq(schema.studyItems.id, item.id))
    expect(rows).toHaveLength(0)
  })

  it('404 ao deletar item inexistente', async () => {
    await expect(StudyService.deleteItem(999, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})
