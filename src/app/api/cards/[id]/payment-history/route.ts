import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CardInvoiceService } from '@/server/services/cardInvoiceService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const card_id = toNumber(id)
    if (!card_id) return err('ID do cartão inválido.', 400)

    const { searchParams } = new URL(request.url)
    const limit = toNumber(searchParams.get('limit')) || 10

    const history = await CardInvoiceService.getPaymentHistory(user.id, card_id, limit)
    return ok(history, 'Histórico de pagamentos recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar histórico de pagamentos.')
  }
}
