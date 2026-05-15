import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ExpenseService } from '@/server/services/expenseService'
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
      const expenses = await ExpenseService.getExpensesByMonthYear(user.id, month, year)
      return ok(expenses.map(formatDatesInObject), 'Despesas recuperadas com sucesso.')
    }

    if (!start_date || !end_date) {
      return err('Parâmetros start_date e end_date são obrigatórios.', 400)
    }

    const expenses = await ExpenseService.getExpensesByDateRange(user.id, start_date, end_date)
    return ok(expenses.map(formatDatesInObject), 'Despesas recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar despesas.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const expenseData = await request.json()

    if (!expenseData.metodo_pagamento || !expenseData.tipo || !expenseData.quantidade) {
      return err('Método de pagamento, tipo e quantidade são obrigatórios.', 400)
    }

    if (!isPositiveNumber(expenseData.quantidade)) {
      return err('Quantidade deve ser um número positivo.', 400)
    }

    const result = await ExpenseService.createExpense(expenseData, user.id)
    const formattedResult = Array.isArray(result) ? result.map(formatDatesInObject) : formatDatesInObject(result)

    return ok(formattedResult, Array.isArray(result) ? 'Despesas criadas com sucesso.' : 'Despesa criada com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar despesa.')
  }
}
