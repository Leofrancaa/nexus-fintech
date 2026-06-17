import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, isAdmin } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { InviteService } from '@/server/services/inviteService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    if (!isAdmin(user)) return err('Acesso restrito ao administrador.', 403)
    const users = await InviteService.listUsers()
    return ok(users, 'Usuários recuperados.')
  } catch (error) {
    return apiError(error, 'Erro ao listar usuários.')
  }
}
