import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { IncomeService } from '@/server/services/incomeService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const month = toNumber(searchParams.get('mes')) || new Date().getMonth() + 1
    const year = toNumber(searchParams.get('ano')) || new Date().getFullYear()

    if (month < 1 || month > 12) {
      return err('Mês deve estar entre 1 e 12.', 400)
    }

    const resume = await IncomeService.getCategoryResume(user.id, month, year)
    return ok(resume, 'Resumo de categorias recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar resumo de categorias de receitas.')
  }
}
