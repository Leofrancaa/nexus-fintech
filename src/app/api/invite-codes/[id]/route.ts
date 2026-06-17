import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse, isAdmin } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { InviteService } from '@/server/services/inviteService'
import { toNumber } from '@/server/utils/helper'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    if (!isAdmin(user)) return err('Acesso restrito ao administrador.', 403)

    const { id } = await params
    const codeId = toNumber(id)
    if (!codeId) return err('ID inválido.', 400)

    const result = await InviteService.remove(codeId)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao remover código de convite.')
  }
}
