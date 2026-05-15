import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { GoalService } from '@/server/services/goalService'
import { toNumber, isPositiveNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const goalId = toNumber(id)
    if (!goalId) return err('ID da meta inválido.', 400)
    const goal = await GoalService.getGoalById(goalId, user.id)
    if (!goal) return err('Meta não encontrada.', 404)
    return ok(goal, 'Meta recuperada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar meta.')
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const goalId = toNumber(id)
    if (!goalId) return err('ID da meta inválido.', 400)
    const updateData = await request.json()
    if (updateData.valor_alvo !== undefined && !isPositiveNumber(updateData.valor_alvo)) {
      return err('Valor deve ser um número positivo.', 400)
    }
    const result = await GoalService.updateGoal(goalId, updateData, user.id)
    return ok(result, 'Meta atualizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar meta.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const goalId = toNumber(id)
    if (!goalId) return err('ID da meta inválido.', 400)
    const result = await GoalService.deleteGoal(goalId, user.id)
    return ok(result, 'Meta removida com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao remover meta.')
  }
}
