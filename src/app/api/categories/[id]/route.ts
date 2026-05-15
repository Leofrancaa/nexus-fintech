import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CategoryService } from '@/server/services/categoryService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const categoryId = toNumber(id)
    if (!categoryId) return err('ID da categoria inválido.', 400)

    const category = await CategoryService.getCategoryById(categoryId, user.id)
    if (!category) return err('Categoria não encontrada.', 404)

    return ok(category, 'Categoria recuperada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar categoria.')
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const categoryId = toNumber(id)
    if (!categoryId) return err('ID da categoria inválido.', 400)

    const updateData = await request.json()
    const updatedCategory = await CategoryService.updateCategory(categoryId, updateData, user.id)
    return ok(updatedCategory, 'Categoria atualizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar categoria.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { id } = await params
    const categoryId = toNumber(id)
    if (!categoryId) return err('ID da categoria inválido.', 400)

    const result = await CategoryService.deleteCategory(categoryId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao deletar categoria.')
  }
}
