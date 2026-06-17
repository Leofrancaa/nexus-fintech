import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { CareerService } from '@/server/services/careerService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    await CareerService.ensureProfile(user.id)
    const milestones = await CareerService.getMilestones(user.id)
    return ok(milestones, 'Marcos de carreira recuperados.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar marcos de carreira.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const data = await request.json()
    const milestone = await CareerService.createMilestone(user.id, data)
    return ok(milestone, 'Marco criado com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar marco.')
  }
}
