import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { CategoryService } from '@/server/services/categoryService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const stats = await CategoryService.getCategoryStats(user.id)
    return ok(stats, 'Estatísticas de categorias recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar estatísticas de categorias.')
  }
}
