import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { GoalService } from '@/server/services/goalService'
import { toNumber, isPositiveNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { searchParams } = new URL(request.url)
    const mes = searchParams.get('mes') ? toNumber(searchParams.get('mes')) ?? undefined : undefined
    const ano = searchParams.get('ano') ? toNumber(searchParams.get('ano')) ?? undefined : undefined
    const goals = await GoalService.getGoalsByUser(user.id, mes, ano)
    return ok(goals, 'Metas recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar metas.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const goalData = await request.json()
    if (!goalData.nome || !goalData.valor_alvo || !goalData.mes || !goalData.ano) {
      return err('Nome, valor_alvo, mes e ano são obrigatórios.', 400)
    }
    if (!isPositiveNumber(goalData.valor_alvo)) {
      return err('Valor deve ser um número positivo.', 400)
    }
    const result = await GoalService.createGoal(goalData, user.id)
    return ok(result, 'Meta criada com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar meta.')
  }
}
