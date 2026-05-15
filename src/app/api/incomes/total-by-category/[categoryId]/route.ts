import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { IncomeService } from '@/server/services/incomeService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { categoryId } = await params
    const catId = toNumber(categoryId)
    if (!catId) return err('ID da categoria inválido.', 400)

    const { searchParams } = new URL(request.url)
    const month = searchParams.get('mes') ? toNumber(searchParams.get('mes')) : new Date().getMonth() + 1
    const year = searchParams.get('ano') ? toNumber(searchParams.get('ano')) : new Date().getFullYear()

    if (!month || !year) return err('Mês e ano devem ser válidos.', 400)

    const total = await IncomeService.getTotalByCategory(user.id, catId, month, year)
    return ok({ total }, 'Total da categoria recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar total da categoria.')
  }
}
