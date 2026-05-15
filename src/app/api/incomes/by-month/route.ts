import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { IncomeService } from '@/server/services/incomeService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const result = await IncomeService.getIncomesGroupedByMonth(user.id)
    return ok(result, 'Receitas por mês recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar receitas por mês.')
  }
}
