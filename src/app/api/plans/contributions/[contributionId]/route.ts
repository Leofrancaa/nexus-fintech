import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { PlanService } from '@/server/services/planService'
import { toNumber } from '@/server/utils/helper'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ contributionId: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { contributionId } = await params
    const contribId = toNumber(contributionId)
    if (!contribId) return err('ID da contribuição inválido.', 400)
    const result = await PlanService.removeContribution(contribId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao remover contribuição.')
  }
}
