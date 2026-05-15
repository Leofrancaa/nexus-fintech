import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err } from '@/server/lib/apiResponse'
import { BalanceCarryoverService } from '@/server/services/balanceCarryoverService'
import { toNumber, resolveUserMessage } from '@/server/utils/helper'

export async function DELETE(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const mes = toNumber(searchParams.get('mes'))
    const ano = toNumber(searchParams.get('ano'))

    if (!mes || !ano) {
      return err('Parâmetros mes e ano são obrigatórios.', 400)
    }

    await BalanceCarryoverService.undo(user.id, mes, ano)
    return ok(null, 'Carryover removido com sucesso.')
  } catch (error) {
    const apiError2 = error as { statusCode?: number; status?: number }
    const status = apiError2?.statusCode || apiError2?.status || 500
    return err(resolveUserMessage(error, 'Erro ao remover saldo anterior.'), status)
  }
}
