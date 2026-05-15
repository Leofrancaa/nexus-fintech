import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { PlanService } from '@/server/services/planService'
import { toNumber, isPositiveNumber } from '@/server/utils/helper'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const planId = toNumber(id)
    if (!planId) return err('ID do plano inválido.', 400)
    const { valor } = await request.json()
    if (!valor || !isPositiveNumber(valor)) {
      return err('Valor da contribuição deve ser um número positivo.', 400)
    }
    const result = await PlanService.addContribution(planId, { valor }, user.id)
    return ok(result, 'Contribuição adicionada com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao adicionar contribuição.')
  }
}
