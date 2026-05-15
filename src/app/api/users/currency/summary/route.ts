import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { CurrencyService } from '@/server/services/currencyService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const summary = await CurrencyService.getUserFinancialSummary(user.id)
    return ok(summary, 'Resumo financeiro recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar resumo financeiro.')
  }
}
