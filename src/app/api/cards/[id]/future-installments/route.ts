import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CardService } from '@/server/services/cardService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const cardId = toNumber(id)
    if (!cardId) return err('ID do cartão inválido.', 400)

    const result = await CardService.getFutureInstallments(cardId, user.id)
    return ok(result, 'Parcelas futuras recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar parcelas futuras.')
  }
}
