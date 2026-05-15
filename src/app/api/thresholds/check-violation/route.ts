import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ThresholdService } from '@/server/services/thresholdService'
import { isPositiveNumber } from '@/server/utils/helper'

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { category_id, amount, month, year } = await request.json()

    if (!category_id || !amount) {
      return err('Category ID e amount são obrigatórios.', 400)
    }

    if (!isPositiveNumber(amount)) {
      return err('Amount deve ser um número positivo.', 400)
    }

    const targetMonth = month ? Number(month) : undefined
    const targetYear = year ? Number(year) : undefined

    const result = await ThresholdService.checkThresholdViolation(user.id, Number(category_id), Number(amount), targetMonth, targetYear)
    return ok(result, 'Verificação de limite realizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao verificar limite.')
  }
}
