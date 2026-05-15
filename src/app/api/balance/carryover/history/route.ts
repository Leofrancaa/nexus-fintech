import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { BalanceCarryoverService } from '@/server/services/balanceCarryoverService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const history = await BalanceCarryoverService.history(user.id)
    return ok(history, 'Histórico de carryovers recuperado.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar histórico.')
  }
}
