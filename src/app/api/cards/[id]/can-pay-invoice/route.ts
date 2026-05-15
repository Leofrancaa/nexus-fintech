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
    const mes = searchParams.get('mes')
    const ano = searchParams.get('ano')

    if (!mes || !ano) return err('Mês e ano são obrigatórios.', 400)

    const result = await CardInvoiceService.canPayInvoice(user.id, card_id, Number(mes), Number(ano))
    return ok(result, 'Verificação realizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao verificar pagamento de fatura.')
  }
}
