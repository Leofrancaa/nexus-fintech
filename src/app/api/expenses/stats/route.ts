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
    const mesRaw = toNumber(searchParams.get('month'))
    const anoRaw = toNumber(searchParams.get('year'))
    const catIdRaw = searchParams.get('categoryId') ? toNumber(searchParams.get('categoryId')) : undefined

    const mes = typeof mesRaw === 'number' && !isNaN(mesRaw) ? mesRaw : undefined
    const ano = typeof anoRaw === 'number' && !isNaN(anoRaw) ? anoRaw : undefined
    const catId = typeof catIdRaw === 'number' && !isNaN(catIdRaw) ? catIdRaw : undefined

    if (!mes || !ano || mes < 1 || mes > 12) {
      return err('Parâmetros month e year são obrigatórios e devem ser válidos.', 400)
    }

    const atual = await ExpenseService.getExpenseStats(user.id, mes, ano, catId)
    const mesAnterior = mes === 1 ? 12 : mes - 1
    const anoAnterior = mes === 1 ? ano - 1 : ano
    const anterior = await ExpenseService.getExpenseStats(user.id, mesAnterior, anoAnterior, catId)

    const stats = {
      total: Number(atual.total || 0),
      fixas: Number(atual.fixas || 0),
      transacoes: Number(atual.transacoes || 0),
      media: Number(atual.media || 0),
      anterior: Number(anterior.total || 0),
    }

    return ok(stats, 'Estatísticas de despesas recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar estatísticas de despesas.')
  }
}
