import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { PlanService } from '@/server/services/planService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const plans = await PlanService.getPlansByUser(user.id)
    return ok(plans, 'Planos recuperados com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar planos.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const planData = await request.json()
    const result = await PlanService.createPlan(planData, user.id)
    return ok(result, 'Plano criado com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar plano.')
  }
}
