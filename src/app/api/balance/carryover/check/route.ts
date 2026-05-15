import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { BalanceCarryoverService } from '@/server/services/balanceCarryoverService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const now = new Date()
    const mes = toNumber(searchParams.get('mes')) ?? now.getMonth() + 1
    const ano = toNumber(searchParams.get('ano')) ?? now.getFullYear()

    if (mes < 1 || mes > 12) {
      return err('Mês deve estar entre 1 e 12.', 400)
    }

    const status = await BalanceCarryoverService.check(user.id, mes, ano)
    return ok(status, 'Status do carryover verificado.')
  } catch (error) {
    return apiError(error, 'Erro ao verificar saldo anterior.')
  }
}
