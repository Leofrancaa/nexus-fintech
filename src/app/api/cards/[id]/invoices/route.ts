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

    const invoices = await CardInvoiceService.getAvailableInvoices(user.id, card_id)
    return ok(invoices, 'Faturas recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar faturas.')
  }
}
