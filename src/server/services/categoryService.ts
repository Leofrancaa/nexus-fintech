// @ts-nocheck
import prisma from '@/server/db/prisma'
import {
    Category,
    CreateCategoryRequest,
} from '@/server/types/index'
import {
    createErrorResponse,
    isValidHexColor,
    sanitizeString
} from '@/server/utils/helper'

export class CategoryService {
    static async createCategory(
        categoryData: CreateCategoryRequest,
        userId: number
    ): Promise<Category> {
        const { nome, cor, tipo, parent_id } = categoryData

        if (!nome || !tipo) {
            throw createErrorResponse("Nome e tipo são obrigatórios.", 400)
        }

        if (tipo !== 'despesa' && tipo !== 'receita') {
            throw createErrorResponse("Tipo deve ser 'despesa' ou 'receita'.", 400)
        }

        if (cor && !isValidHexColor(cor)) {
            throw createErrorResponse("Cor deve estar no formato hexadecimal válido.", 400)
        }

        const existing = await prisma.category.findFirst({
            where: { nome: nome.trim(), user_id: userId, tipo }
        })

        if (existing) {
            throw createErrorResponse(`Já existe uma categoria ${tipo} com este nome.`, 409)
        }

        if (cor) {
            const colorExists = await prisma.category.findFirst({
                where: { cor, user_id: userId, tipo }
            })

            if (colorExists) {
                throw createErrorResponse(
                    `A cor selecionada já está sendo usada pela categoria "${colorExists.nome}" do tipo ${tipo}.`,
                    409
                )
            }
        }

        if (parent_id) {
            const parent = await prisma.category.findFirst({
                where: { id: parent_id, user_id: userId }
            })

            if (!parent) {
                throw createErrorResponse("Categoria pai não encontrada.", 404)
            }

            if (parent.tipo !== tipo) {
                throw createErrorResponse("Categoria pai deve ser do mesmo tipo.", 400)
            }
        }

        const result = await prisma.category.create({
            data: {
                nome: sanitizeString(nome.trim()),
                cor: cor || '#6B7280',
                tipo,
                parent_id: parent_id || null,
                user_id: userId,
            }
        })

        return result as unknown as Category
    }

    static async getCategoriesByUser(
        userId: number,
        tipo?: 'despesa' | 'receita'
    ): Promise<Category[]> {
        const categories = await prisma.category.findMany({
            where: {
                user_id: userId,
                ...(tipo === 'despesa' || tipo === 'receita' ? { tipo } : {})
            },
            orderBy: [
                { parent_id: 'asc' },
                { nome: 'asc' }
            ]
        })

        return categories as unknown as Category[]
    }

    static async getCategoryById(categoryId: number, userId: number): Promise<Category | null> {
        const category = await prisma.category.findFirst({
            where: { id: categoryId, user_id: userId }
        })

        return category as unknown as Category | null
    }

    static async updateCategory(
        categoryId: number,
        updateData: Partial<CreateCategoryRequest>,
        userId: number
    ): Promise<Category> {
        const { nome, cor, tipo, parent_id } = updateData

        const existsResult = await this.getCategoryById(categoryId, userId)
        if (!existsResult) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        if (tipo && tipo !== 'despesa' && tipo !== 'receita') {
            throw createErrorResponse("Tipo deve ser 'despesa' ou 'receita'.", 400)
        }

        if (cor && !isValidHexColor(cor)) {
            throw createErrorResponse("Cor deve estar no formato hexadecimal válido.", 400)
        }

        if (parent_id && parent_id === categoryId) {
            throw createErrorResponse("Uma categoria não pode ser pai de si mesma.", 400)
        }

        if (parent_id) {
            const parent = await prisma.category.findFirst({
                where: { id: parent_id, user_id: userId }
            })

            if (!parent) {
                throw createErrorResponse("Categoria pai não encontrada.", 404)
            }

            const currentTipo = tipo || existsResult.tipo
            if (parent.tipo !== currentTipo) {
                throw createErrorResponse("Categoria pai deve ser do mesmo tipo.", 400)
            }
        }

        if (nome) {
            const duplicate = await prisma.category.findFirst({
                where: {
                    nome: nome.trim(),
                    user_id: userId,
                    tipo: tipo || existsResult.tipo,
                    id: { not: categoryId }
                }
            })

            if (duplicate) {
                throw createErrorResponse(`Já existe uma categoria com este nome.`, 409)
            }
        }

        const result = await prisma.category.update({
            where: { id: categoryId },
            data: {
                ...(nome !== undefined ? { nome: sanitizeString(nome.trim()) } : {}),
                ...(cor !== undefined ? { cor } : {}),
                ...(tipo !== undefined ? { tipo } : {}),
                ...(parent_id !== undefined ? { parent_id } : {}),
            }
        })

        return result as unknown as Category
    }

    static async deleteCategory(categoryId: number, userId: number): Promise<{ message: string; deletedItems: { subcategorias: number; despesas: number; receitas: number } }> {
        const category = await this.getCategoryById(categoryId, userId)
        if (!category) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        const subcategoryIds = await this.getAllSubcategoryIds(categoryId, userId)
        const allCategoryIds = [categoryId, ...subcategoryIds]

        const [expensesCount, incomesCount] = await Promise.all([
            prisma.expense.count({ where: { category_id: { in: allCategoryIds }, user_id: userId } }),
            prisma.income.count({ where: { category_id: { in: allCategoryIds }, user_id: userId } }),
        ])

        await prisma.$transaction([
            prisma.expense.deleteMany({ where: { category_id: { in: allCategoryIds }, user_id: userId } }),
            prisma.income.deleteMany({ where: { category_id: { in: allCategoryIds }, user_id: userId } }),
            prisma.threshold.deleteMany({ where: { category_id: { in: allCategoryIds }, user_id: userId } }),
            ...(subcategoryIds.length > 0 ? [prisma.category.deleteMany({ where: { id: { in: subcategoryIds }, user_id: userId } })] : []),
            prisma.category.delete({ where: { id: categoryId } }),
        ])

        return {
            message: "Categoria removida com sucesso.",
            deletedItems: {
                subcategorias: subcategoryIds.length,
                despesas: expensesCount,
                receitas: incomesCount
            }
        }
    }

    private static async getAllSubcategoryIds(categoryId: number, userId: number): Promise<number[]> {
        const children = await prisma.category.findMany({
            where: { parent_id: categoryId, user_id: userId },
            select: { id: true }
        })

        const subcategoryIds: number[] = children.map(c => c.id)

        for (const subId of subcategoryIds) {
            const childIds = await this.getAllSubcategoryIds(subId, userId)
            subcategoryIds.push(...childIds)
        }

        return subcategoryIds
    }

    static async getCategoryStats(userId: number): Promise<Array<{
        id: number
        nome: string
        tipo: 'despesa' | 'receita'
        total_transacoes: number
        valor_total: number
        ultima_utilizacao: Date | null
    }>> {
        const result = await prisma.$queryRaw<Array<{
            id: number
            nome: string
            tipo: string
            total_transacoes: bigint
            valor_total: string
            ultima_utilizacao: Date | null
        }>>`
            SELECT
                c.id,
                c.nome,
                c.tipo,
                COALESCE(expense_stats.total_transacoes, 0) + COALESCE(income_stats.total_transacoes, 0) as total_transacoes,
                COALESCE(expense_stats.valor_total, 0) + COALESCE(income_stats.valor_total, 0) as valor_total,
                GREATEST(expense_stats.ultima_utilizacao, income_stats.ultima_utilizacao) as ultima_utilizacao
            FROM categories c
            LEFT JOIN (
                SELECT category_id, COUNT(*) as total_transacoes, SUM(quantidade) as valor_total, MAX(data) as ultima_utilizacao
                FROM expenses WHERE user_id = ${userId} GROUP BY category_id
            ) expense_stats ON c.id = expense_stats.category_id
            LEFT JOIN (
                SELECT category_id, COUNT(*) as total_transacoes, SUM(quantidade) as valor_total, MAX(data) as ultima_utilizacao
                FROM incomes WHERE user_id = ${userId} GROUP BY category_id
            ) income_stats ON c.id = income_stats.category_id
            WHERE c.user_id = ${userId}
            ORDER BY total_transacoes DESC
        `

        return result.map(row => ({
            id: row.id,
            nome: row.nome,
            tipo: row.tipo as 'despesa' | 'receita',
            total_transacoes: Number(row.total_transacoes),
            valor_total: Number(row.valor_total),
            ultima_utilizacao: row.ultima_utilizacao
        }))
    }

    static async getCategoryTree(
        userId: number,
        tipo?: 'despesa' | 'receita'
    ): Promise<Array<Category & { children?: Category[] }>> {
        const categories = await this.getCategoriesByUser(userId, tipo)

        const categoryMap = new Map<number, Category & { children?: Category[] }>()
        const rootCategories: Array<Category & { children?: Category[] }> = []

        categories.forEach(cat => {
            categoryMap.set(cat.id, { ...cat, children: [] })
        })

        categories.forEach(cat => {
            const categoryWithChildren = categoryMap.get(cat.id)!

            if (cat.parent_id) {
                const parent = categoryMap.get(cat.parent_id)
                if (parent) {
                    parent.children = parent.children || []
                    parent.children.push(categoryWithChildren)
                }
            } else {
                rootCategories.push(categoryWithChildren)
            }
        })

        return rootCategories
    }
}
