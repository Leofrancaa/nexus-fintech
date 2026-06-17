import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { StudyService } from '@/server/services/studyService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const items = await StudyService.getItems(user.id)
    return ok(items, 'Itens de estudo recuperados.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar itens de estudo.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const data = await request.json()
    const item = await StudyService.createItem(user.id, data)
    return ok(item, 'Item criado com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar item de estudo.')
  }
}
