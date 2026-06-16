import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { PersonalService } from '@/server/services/personalService'
import { toNumber } from '@/server/utils/helper'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const goalId = toNumber(id)
    if (!goalId) return err('ID da meta inválido.', 400)
    const data = await request.json()
    const goal = await PersonalService.updateGoal(goalId, user.id, data)
    return ok(goal, 'Meta atualizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar meta pessoal.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const goalId = toNumber(id)
    if (!goalId) return err('ID da meta inválido.', 400)
    const result = await PersonalService.deleteGoal(goalId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao remover meta pessoal.')
  }
}
