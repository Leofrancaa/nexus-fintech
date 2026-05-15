import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ThresholdService } from '@/server/services/thresholdService'
import { toNumber, isPositiveNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const thresholdId = toNumber(id)
    if (!thresholdId) return err('ID do limite inválido.', 400)

    const threshold = await ThresholdService.getThresholdById(thresholdId, user.id)
    if (!threshold) return err('Limite não encontrado.', 404)

    return ok(threshold, 'Limite recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar limite.')
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const thresholdId = toNumber(id)
    if (!thresholdId) return err('ID do limite inválido.', 400)

    const updateData = await request.json()

    if (updateData.valor !== undefined && !isPositiveNumber(updateData.valor)) {
      return err('Valor deve ser um número positivo.', 400)
    }

    const updatedThreshold = await ThresholdService.updateThreshold(thresholdId, updateData, user.id)
    return ok(updatedThreshold, 'Limite atualizado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar limite.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const thresholdId = toNumber(id)
    if (!thresholdId) return err('ID do limite inválido.', 400)

    const result = await ThresholdService.deleteThreshold(thresholdId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao deletar limite.')
  }
}
