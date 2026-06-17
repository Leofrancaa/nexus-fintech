import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, isAdmin } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { InviteService } from '@/server/services/inviteService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    if (!isAdmin(user)) return err('Acesso restrito ao administrador.', 403)
    const codes = await InviteService.list()
    return ok(codes, 'Códigos recuperados.')
  } catch (error) {
    return apiError(error, 'Erro ao listar códigos de convite.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    if (!isAdmin(user)) return err('Acesso restrito ao administrador.', 403)

    const body = await request.json().catch(() => ({}))
    const expiresInDays =
      typeof body?.expiresInDays === 'number' ? body.expiresInDays : undefined

    const code = await InviteService.create(user.id, expiresInDays)
    return ok(code, 'Código gerado com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao gerar código de convite.')
  }
}
