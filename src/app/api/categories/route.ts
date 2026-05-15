import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { CategoryService } from '@/server/services/categoryService'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const tipo = searchParams.get('tipo')
    const tree = searchParams.get('tree')

    if (tipo && tipo !== 'despesa' && tipo !== 'receita') {
      return err('Tipo deve ser "despesa" ou "receita".', 400)
    }

    if (tree === 'true') {
      const categories = await CategoryService.getCategoryTree(user.id, tipo as 'despesa' | 'receita' | undefined)
      return ok(categories, 'Árvore de categorias recuperada com sucesso.')
    }

    const categories = await CategoryService.getCategoriesByUser(user.id, tipo as 'despesa' | 'receita' | undefined)
    return ok(categories, 'Categorias recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar categorias.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const categoryData = await request.json()
    const result = await CategoryService.createCategory(categoryData, user.id)
    return ok(result, 'Categoria criada com sucesso.', 201)
  } catch (error) {
    return apiError(error, 'Erro ao criar categoria.')
  }
}
