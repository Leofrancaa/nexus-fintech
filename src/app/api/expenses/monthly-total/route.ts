import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ExpenseService } from '@/server/services/expenseService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const month = toNumber(searchParams.get('mes'))
    const year = toNumber(searchParams.get('ano'))

    if (!month || !year || month < 1 || month > 12) {
      return err('Parâmetros mes e ano são obrigatórios e devem ser válidos.', 400)
    }

    const total = await ExpenseService.getMonthlyTotal(user.id, month, year)
    return ok({ total }, 'Total mensal recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar total mensal.')
  }
}
