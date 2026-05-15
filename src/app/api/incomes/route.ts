import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { IncomeService } from '@/server/services/incomeService'
import { toNumber, isPositiveNumber, formatDatesInObject } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const start_date = searchParams.get('start_date')
    const end_date = searchParams.get('end_date')
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')

    if (mes && ano) {
      const month = toNumber(mes)
      const year = toNumber(ano)
      if (!month || !year || month < 1 || month > 12) {
        return err('Mês deve estar entre 1 e 12, e ano deve ser válido.', 400)
      }
      const incomes = await IncomeService.getIncomesByMonthYear(user.id, month, year)
      return ok(incomes.map(formatDatesInObject), 'Receitas recuperadas com sucesso.')
    }

    if (!start_date || !end_date) {
      return err('Parâmetros start_date e end_date são obrigatórios.', 400)
    }

    const incomes = await IncomeService.getIncomesByDateRange(user.id, start_date, end_date)
    return ok(incomes.map(formatDatesInObject), 'Receitas recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar receitas.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const incomeData = await request.json()

    if (!incomeData.tipo || !incomeData.quantidade) {
      return err('Tipo e quantidade são obrigatórios.', 400)
    }

    if (!isPositiveNumber(incomeData.quantidade)) {
      return err('Quantidade deve ser um número positivo.', 400)
    }

    const result = await IncomeService.createIncome(incomeData, user.id)
    const message = Array.isArray(result)
      ? `${result.length} receitas criadas com sucesso (receita fixa replicada).`
      : 'Receita criada com sucesso.'
    const formatted = Array.isArray(result) ? result.map(formatDatesInObject) : formatDatesInObject(result)
    return ok(formatted, message, 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar receita.')
  }
}
