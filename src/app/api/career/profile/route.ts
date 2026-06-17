import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { CareerService } from '@/server/services/careerService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    await CareerService.ensureProfile(user.id)
    const profile = await CareerService.getProfile(user.id)
    const progress = await CareerService.getProgress(user.id)
    return ok({ profile, progress }, 'Perfil de carreira recuperado.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar perfil de carreira.')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const data = await request.json()
    const profile = await CareerService.updateProfile(user.id, data)
    return ok(profile, 'Perfil de carreira atualizado.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar perfil de carreira.')
  }
}
