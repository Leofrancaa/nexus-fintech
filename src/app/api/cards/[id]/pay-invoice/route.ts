import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CardInvoiceService } from '@/server/services/cardInvoiceService'
import { toNumber } from '@/server/utils/helper'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const card_id = toNumber(id)
    if (!card_id) return err('ID do cartão inválido.', 400)

    const { mes, ano } = await request.json()

    if (typeof mes !== 'number' || typeof ano !== 'number') {
      return err('Mês e ano são obrigatórios e devem ser números.', 400)
    }

    const result = await CardInvoiceService.payCardInvoice({ user_id: user.id, card_id, mes: Number(mes), ano: Number(ano) })
    return ok(result, 'Fatura paga e limite atualizado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao pagar fatura.')
  }
}
