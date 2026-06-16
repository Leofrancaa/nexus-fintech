import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CareerService } from '@/server/services/careerService'
import { toNumber } from '@/server/utils/helper'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const milestoneId = toNumber(id)
    if (!milestoneId) return err('ID do marco inválido.', 400)
    const data = await request.json()
    const milestone = await CareerService.updateMilestone(milestoneId, user.id, data)
    return ok(milestone, 'Marco atualizado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar marco.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const milestoneId = toNumber(id)
    if (!milestoneId) return err('ID do marco inválido.', 400)
    const result = await CareerService.deleteMilestone(milestoneId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao remover marco.')
  }
}
