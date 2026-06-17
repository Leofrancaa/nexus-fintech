import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { InviteService } from '@/server/services/inviteService'

const ADMIN_ID = 53

describe('InviteService', () => {
  it('cria um código de convite não usado', async () => {
    const code = await InviteService.create(ADMIN_ID)
    expect(code.code).toMatch(/^[A-Z0-9]{8}$/)
    expect(code.is_used).toBe(false)
    expect(code.created_by).toBe(ADMIN_ID)
    expect(code.expires_at).toBeNull()
  })

  it('define expiração quando expiresInDays é informado', async () => {
    const code = await InviteService.create(ADMIN_ID, 7)
    expect(code.expires_at).not.toBeNull()
    const diffDays =
      (new Date(code.expires_at as Date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThan(6)
    expect(diffDays).toBeLessThan(8)
  })

  it('lista os códigos com info de quem usou', async () => {
    const [user] = await db
      .insert(schema.users)
      .values({ nome: 'Fulano', email: 'fulano@x.com', senha: 'h' })
      .returning()
    await db.insert(schema.inviteCodes).values({
      code: 'USEDCODE',
      created_by: ADMIN_ID,
      is_used: true,
      used_by: user.id,
    })

    const list = await InviteService.list()
    const used = list.find((c) => c.code === 'USEDCODE')!
    expect(used.used_by_name).toBe('Fulano')
    expect(used.used_by_email).toBe('fulano@x.com')
  })

  it('remove um código existente e dá 404 em inexistente', async () => {
    const code = await InviteService.create(ADMIN_ID)
    const res = await InviteService.remove(code.id)
    expect(res.message).toContain('sucesso')

    const rows = await db
      .select()
      .from(schema.inviteCodes)
      .where(eq(schema.inviteCodes.id, code.id))
    expect(rows).toHaveLength(0)

    await expect(InviteService.remove(999999)).rejects.toMatchObject({ status: 404 })
  })

  it('lista usuários', async () => {
    await db
      .insert(schema.users)
      .values({ nome: 'Ana', email: 'ana@x.com', senha: 'h' })
    const users = await InviteService.listUsers()
    expect(users.length).toBeGreaterThan(0)
    expect(users[0]).toHaveProperty('email')
  })
})
