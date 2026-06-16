import { and, eq, asc, sql, count, inArray } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { categories, expenses, incomes, thresholds } from '@/server/db/schema'
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

        const [existing] = await db
            .select()
            .from(categories)
            .where(
                and(
                    eq(categories.nome, nome.trim()),
                    eq(categories.user_id, userId),
                    eq(categories.tipo, tipo)
                )
            )
            .limit(1)

        if (existing) {
            throw createErrorResponse(`Já existe uma categoria ${tipo} com este nome.`, 409)
        }

        if (cor) {
            const [colorExists] = await db
                .select()
                .from(categories)
                .where(
                    and(
                        eq(categories.cor, cor),
                        eq(categories.user_id, userId),
                        eq(categories.tipo, tipo)
                    )
                )
                .limit(1)

            if (colorExists) {
                throw createErrorResponse(
                    `A cor selecionada já está sendo usada pela categoria "${colorExists.nome}" do tipo ${tipo}.`,
                    409
                )
            }
        }

        if (parent_id) {
            const [parent] = await db
                .select()
                .from(categories)
                .where(and(eq(categories.id, parent_id), eq(categories.user_id, userId)))
                .limit(1)

            if (!parent) {
                throw createErrorResponse("Categoria pai não encontrada.", 404)
            }

            if (parent.tipo !== tipo) {
                throw createErrorResponse("Categoria pai deve ser do mesmo tipo.", 400)
            }
        }

        const [result] = await db
            .insert(categories)
            .values({
                nome: sanitizeString(nome.trim()),
                cor: cor || '#6B7280',
                tipo,
                parent_id: parent_id || null,
                user_id: userId,
            })
            .returning()

        return result as unknown as Category
    }

    static async getCategoriesByUser(
        userId: number,
        tipo?: 'despesa' | 'receita'
    ): Promise<Category[]> {
        const conditions = [eq(categories.user_id, userId)]
        if (tipo === 'despesa' || tipo === 'receita') conditions.push(eq(categories.tipo, tipo))

        const rows = await db
            .select()
            .from(categories)
            .where(and(...conditions))
            .orderBy(asc(categories.parent_id), asc(categories.nome))

        return rows as unknown as Category[]
    }

    static async getCategoryById(categoryId: number, userId: number): Promise<Category | null> {
        const [category] = await db
            .select()
            .from(categories)
            .where(and(eq(categories.id, categoryId), eq(categories.user_id, userId)))
            .limit(1)

        return (category ?? null) as unknown as Category | null
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
            const [parent] = await db
                .select()
                .from(categories)
                .where(and(eq(categories.id, parent_id), eq(categories.user_id, userId)))
                .limit(1)

            if (!parent) {
                throw createErrorResponse("Categoria pai não encontrada.", 404)
            }

            const currentTipo = tipo || existsResult.tipo
            if (parent.tipo !== currentTipo) {
                throw createErrorResponse("Categoria pai deve ser do mesmo tipo.", 400)
            }
        }

        if (nome) {
            const [duplicate] = await db
                .select()
                .from(categories)
                .where(
                    and(
                        eq(categories.nome, nome.trim()),
                        eq(categories.user_id, userId),
                        eq(categories.tipo, tipo || existsResult.tipo),
                        sql`${categories.id} <> ${categoryId}`
                    )
                )
                .limit(1)

            if (duplicate) {
                throw createErrorResponse(`Já existe uma categoria com este nome.`, 409)
            }
        }

        const [result] = await db
            .update(categories)
            .set({
                ...(nome !== undefined ? { nome: sanitizeString(nome.trim()) } : {}),
                ...(cor !== undefined ? { cor } : {}),
                ...(tipo !== undefined ? { tipo } : {}),
                ...(parent_id !== undefined ? { parent_id } : {}),
            })
            .where(eq(categories.id, categoryId))
            .returning()

        return result as unknown as Category
    }

    static async deleteCategory(categoryId: number, userId: number): Promise<{ message: string; deletedItems: { subcategorias: number; despesas: number; receitas: number } }> {
        const category = await this.getCategoryById(categoryId, userId)
        if (!category) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        const subcategoryIds = await this.getAllSubcategoryIds(categoryId, userId)
        const allCategoryIds = [categoryId, ...subcategoryIds]

        const [expensesCountRow, incomesCountRow] = await Promise.all([
            db.select({ c: count() }).from(expenses).where(
                and(inArray(expenses.category_id, allCategoryIds), eq(expenses.user_id, userId))
            ),
            db.select({ c: count() }).from(incomes).where(
                and(inArray(incomes.category_id, allCategoryIds), eq(incomes.user_id, userId))
            ),
        ])

        const expensesCount = Number(expensesCountRow[0]?.c ?? 0)
        const incomesCount = Number(incomesCountRow[0]?.c ?? 0)

        await db.transaction(async (tx) => {
            await tx.delete(expenses).where(
                and(inArray(expenses.category_id, allCategoryIds), eq(expenses.user_id, userId))
            )
            await tx.delete(incomes).where(
                and(inArray(incomes.category_id, allCategoryIds), eq(incomes.user_id, userId))
            )
            await tx.delete(thresholds).where(
                and(inArray(thresholds.category_id, allCategoryIds), eq(thresholds.user_id, userId))
            )
            if (subcategoryIds.length > 0) {
                await tx.delete(categories).where(
                    and(inArray(categories.id, subcategoryIds), eq(categories.user_id, userId))
                )
            }
            await tx.delete(categories).where(eq(categories.id, categoryId))
        })

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
        const children = await db
            .select({ id: categories.id })
            .from(categories)
            .where(and(eq(categories.parent_id, categoryId), eq(categories.user_id, userId)))

        const subcategoryIds: number[] = children.map((c) => c.id)

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
        const queryResult = await db.execute(sql`
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
        `)

        const result = queryResult.rows as unknown as Array<{
            id: number
            nome: string
            tipo: string
            total_transacoes: bigint | string
            valor_total: string
            ultima_utilizacao: Date | null
        }>

        return result.map((row) => ({
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
        const cats = await this.getCategoriesByUser(userId, tipo)

        const categoryMap = new Map<number, Category & { children?: Category[] }>()
        const rootCategories: Array<Category & { children?: Category[] }> = []

        cats.forEach(cat => {
            categoryMap.set(cat.id, { ...cat, children: [] })
        })

        cats.forEach(cat => {
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
