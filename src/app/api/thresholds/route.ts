import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ThresholdService } from '@/server/services/thresholdService'
import { isPositiveNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const thresholds = await ThresholdService.getThresholdsByUser(user.id)
    return ok(thresholds, 'Limites recuperados com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar limites.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const thresholdData = await request.json()

    if (!thresholdData.category_id || !thresholdData.valor) {
      return err('Category ID e valor são obrigatórios.', 400)
    }

    if (!isPositiveNumber(thresholdData.valor)) {
      return err('Valor deve ser um número positivo.', 400)
    }

    const result = await ThresholdService.createOrUpdateThreshold(thresholdData, user.id)
    return ok(result, 'Limite criado/atualizado com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar limite.')
  }
}
