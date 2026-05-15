import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ExpenseService } from '@/server/services/expenseService'
import { toNumber, isPositiveNumber, formatDatesInObject } from '@/server/utils/helper'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const expenseId = toNumber(id)
    if (!expenseId) return err('ID da despesa inválido.', 400)

    const updateData = await request.json()

    if (updateData.quantidade !== undefined && !isPositiveNumber(updateData.quantidade)) {
      return err('Quantidade deve ser um número positivo.', 400)
    }

    const updatedExpense = await ExpenseService.updateExpense(expenseId, updateData, user.id)
    return ok(formatDatesInObject(updatedExpense), 'Despesa atualizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar despesa.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const expenseId = toNumber(id)
    if (!expenseId) return err('ID da despesa inválido.', 400)

    const deletedExpense = await ExpenseService.deleteExpense(expenseId, user.id)
    const message = Array.isArray(deletedExpense)
      ? `${deletedExpense.length} despesas removidas com sucesso.`
      : 'Despesa removida com sucesso.'

    return ok(deletedExpense, message)
  } catch (error) {
    return apiError(error, 'Erro ao deletar despesa.')
  }
}
