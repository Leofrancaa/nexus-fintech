import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { ThresholdService } from '@/server/services/thresholdService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const stats = await ThresholdService.getThresholdStats(user.id)
    return ok(stats, 'Estatísticas de limites recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar estatísticas de limites.')
  }
}
