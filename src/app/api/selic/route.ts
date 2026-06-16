import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { getSelicAnual } from '@/server/services/selicService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const selic = await getSelicAnual()
    return ok(selic, 'Selic recuperada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar a Selic.')
  }
}
