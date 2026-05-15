import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { GoalService } from '@/server/services/goalService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') ? toNumber(searchParams.get('mes')) ?? undefined : undefined
    const ano = searchParams.get('ano') ? toNumber(searchParams.get('ano')) ?? undefined : undefined
    const stats = await GoalService.getGoalStats(user.id, mes, ano)
    return ok(stats, 'Estatísticas recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar estatísticas.')
  }
}
