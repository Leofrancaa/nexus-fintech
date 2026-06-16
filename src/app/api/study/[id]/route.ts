import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { StudyService } from '@/server/services/studyService'
import { toNumber } from '@/server/utils/helper'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const itemId = toNumber(id)
    if (!itemId) return err('ID do item inválido.', 400)
    const data = await request.json()
    const item = await StudyService.updateItem(itemId, user.id, data)
    return ok(item, 'Item atualizado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar item de estudo.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const itemId = toNumber(id)
    if (!itemId) return err('ID do item inválido.', 400)
    const result = await StudyService.deleteItem(itemId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao remover item de estudo.')
  }
}
