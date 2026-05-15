import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { PlanService } from '@/server/services/planService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const stats = await PlanService.getPlanStats(user.id)
    return ok(stats, 'Estatísticas de planos recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar estatísticas de planos.')
  }
}
