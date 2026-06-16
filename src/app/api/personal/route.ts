import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { PersonalService } from '@/server/services/personalService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const goals = await PersonalService.getGoals(user.id)
    return ok(goals, 'Metas pessoais recuperadas.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar metas pessoais.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const data = await request.json()
    const goal = await PersonalService.createGoal(user.id, data)
    return ok(goal, 'Meta criada com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar meta pessoal.')
  }
}
