import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CurrencyService } from '@/server/services/currencyService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const result = await CurrencyService.getUserCurrency(user.id)
    return ok(result, 'Moeda do usuário recuperada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar moeda do usuário.')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { currency } = await request.json()
    if (!currency) return err('Moeda é obrigatória.', 400)
    const result = await CurrencyService.updateUserCurrency(user.id, currency)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao atualizar moeda.')
  }
}
