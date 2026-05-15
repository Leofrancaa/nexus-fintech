import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { PlanService } from '@/server/services/planService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const planId = toNumber(id)
    if (!planId) return err('ID do plano inválido.', 400)
    const { searchParams } = new URL(request.url)
    const limit = toNumber(searchParams.get('limit')) || 20
    const contributions = await PlanService.getPlanContributions(planId, user.id, limit)
    return ok(contributions, 'Contribuições recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar contribuições.')
  }
}
