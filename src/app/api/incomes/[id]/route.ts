import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { IncomeService } from '@/server/services/incomeService'
import { toNumber, isPositiveNumber, formatDatesInObject } from '@/server/utils/helper'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const incomeId = toNumber(id)
    if (!incomeId) return err('ID da receita inválido.', 400)

    const updateData = await request.json()

    if (updateData.quantidade !== undefined && !isPositiveNumber(updateData.quantidade)) {
      return err('Quantidade deve ser um número positivo.', 400)
    }

    const updatedIncome = await IncomeService.updateIncome(incomeId, updateData, user.id)
    return ok(formatDatesInObject(updatedIncome), 'Receita atualizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar receita.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const incomeId = toNumber(id)
    if (!incomeId) return err('ID da receita inválido.', 400)

    const deletedIncome = await IncomeService.deleteIncome(incomeId, user.id)
    const message = Array.isArray(deletedIncome)
      ? `${deletedIncome.length} receitas removidas com sucesso.`
      : 'Receita removida com sucesso.'

    return ok(deletedIncome, message)
  } catch (error) {
    return apiError(error, 'Erro ao deletar receita.')
  }
}
