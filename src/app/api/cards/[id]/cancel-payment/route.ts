import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CardInvoiceService } from '@/server/services/cardInvoiceService'
import { toNumber } from '@/server/utils/helper'

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const card_id = toNumber(id)
    if (!card_id) return err('ID do cartão inválido.', 400)

    const { competencia_mes, competencia_ano } = await request.json()

    if (!competencia_mes || !competencia_ano) {
      return err('Mês e ano da competência são obrigatórios.', 400)
    }

    const result = await CardInvoiceService.cancelInvoicePayment(user.id, card_id, Number(competencia_mes), Number(competencia_ano))
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao cancelar pagamento.')
  }
}
