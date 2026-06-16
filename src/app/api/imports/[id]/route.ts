import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ImportService } from '@/server/services/importService'
import { toNumber } from '@/server/utils/helper'

// Recupera um lote de importação para revisão.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const batchId = toNumber(id)
    if (!batchId) return err('ID da importação inválido.', 400)
    const result = await ImportService.getBatch(batchId, user.id)
    return ok(result, 'Importação recuperada.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar importação.')
  }
}

// Confirma o lote (cria as despesas/receitas reais).
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const batchId = toNumber(id)
    if (!batchId) return err('ID da importação inválido.', 400)
    const result = await ImportService.confirmImport(batchId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao confirmar importação.')
  }
}
