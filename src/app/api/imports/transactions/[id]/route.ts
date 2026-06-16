import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ImportService } from '@/server/services/importService'
import { toNumber } from '@/server/utils/helper'

// Edita uma transação importada antes da confirmação (tipo, categoria, incluir/ignorar).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const txId = toNumber(id)
    if (!txId) return err('ID da transação inválido.', 400)
    const data = await request.json()
    const result = await ImportService.updateTransaction(txId, user.id, data)
    return ok(result, 'Transação atualizada.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar transação.')
  }
}
