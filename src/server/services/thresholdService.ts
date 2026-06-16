import { and, eq, asc, sql, count, sum } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { thresholds, categories } from '@/server/db/schema'
import {
    Threshold,
    CreateThresholdRequest,
} from '@/server/types/index'
import {
    createErrorResponse,
    isPositiveNumber
} from '@/server/utils/helper'

interface ThresholdWithCategory extends Threshold {
    categoria: {
        id: number
        nome: string
        cor: string
        tipo: 'despesa' | 'receita'
    }
}

interface ThresholdAlert {
    threshold_id: number
    category_name: string
    category_color: string
    limit_value: number
    current_spending: number
    percentage_used: number
    remaining: number
    is_exceeded: boolean
    alert_level: 'safe' | 'warning' | 'danger' | 'exceeded'
}

export class ThresholdService {
    static async createOrUpdateThreshold(
        thresholdData: CreateThresholdRequest,
        userId: number
    ): Promise<Threshold> {
        const { category_id, valor } = thresholdData

        if (!category_id || !isPositiveNumber(valor)) {
            throw createErrorResponse("Category ID e valor positivo são obrigatórios.", 400)
        }

        const [category] = await db
            .select()
            .from(categories)
            .where(and(eq(categories.id, category_id), eq(categories.user_id, userId)))
            .limit(1)

        if (!category) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        if (category.tipo !== 'despesa') {
            throw createErrorResponse("Limites só podem ser definidos para categorias de despesa.", 400)
        }

        const [result] = await db
            .insert(thresholds)
            .values({ user_id: userId, category_id, valor: String(valor) })
            .onConflictDoUpdate({
                target: [thresholds.user_id, thresholds.category_id],
                set: { valor: String(valor) },
            })
            .returning()

        return { ...result, valor: Number(result.valor) } as unknown as Threshold
    }

    static async getThresholdsByUser(userId: number): Promise<ThresholdWithCategory[]> {
        const rows = await db
            .select({
                id: thresholds.id,
                user_id: thresholds.user_id,
                category_id: thresholds.category_id,
                valor: thresholds.valor,
                created_at: thresholds.created_at,
                updated_at: thresholds.updated_at,
                cat_id: categories.id,
                cat_nome: categories.nome,
                cat_cor: categories.cor,
                cat_tipo: categories.tipo,
            })
            .from(thresholds)
            .innerJoin(categories, eq(thresholds.category_id, categories.id))
            .where(eq(thresholds.user_id, userId))
            .orderBy(asc(thresholds.category_id))

        return rows.map((t) => ({
            id: t.id,
            user_id: t.user_id,
            category_id: t.category_id,
            valor: Number(t.valor),
            created_at: t.created_at,
            updated_at: t.updated_at,
            categoria: {
                id: t.cat_id,
                nome: t.cat_nome,
                cor: t.cat_cor,
                tipo: t.cat_tipo as 'despesa' | 'receita',
            }
        }))
    }

    static async getThresholdById(thresholdId: number, userId: number): Promise<Threshold | null> {
        const [threshold] = await db
            .select()
            .from(thresholds)
            .where(and(eq(thresholds.id, thresholdId), eq(thresholds.user_id, userId)))
            .limit(1)

        if (!threshold) return null

        return { ...threshold, valor: Number(threshold.valor) } as unknown as Threshold
    }

    static async updateThreshold(
        thresholdId: number,
        updateData: Partial<CreateThresholdRequest>,
        userId: number
    ): Promise<Threshold> {
        const { category_id, valor } = updateData

        const exists = await this.getThresholdById(thresholdId, userId)
        if (!exists) {
            throw createErrorResponse("Threshold não encontrado.", 404)
        }

        if (valor !== undefined && !isPositiveNumber(valor)) {
            throw createErrorResponse("Valor deve ser um número positivo.", 400)
        }

        if (category_id) {
            const [category] = await db
                .select()
                .from(categories)
                .where(and(eq(categories.id, category_id), eq(categories.user_id, userId)))
                .limit(1)

            if (!category) {
                throw createErrorResponse("Categoria não encontrada.", 404)
            }

            if (category.tipo !== 'despesa') {
                throw createErrorResponse("Limites só podem ser definidos para categorias de despesa.", 400)
            }

            const [existing] = await db
                .select()
                .from(thresholds)
                .where(
                    and(
                        eq(thresholds.category_id, category_id),
                        eq(thresholds.user_id, userId),
                        sql`${thresholds.id} <> ${thresholdId}`
                    )
                )
                .limit(1)

            if (existing) {
                throw createErrorResponse("Já existe um limite definido para esta categoria.", 409)
            }
        }

        const [result] = await db
            .update(thresholds)
            .set({
                ...(category_id !== undefined ? { category_id } : {}),
                ...(valor !== undefined ? { valor: String(valor) } : {}),
            })
            .where(eq(thresholds.id, thresholdId))
            .returning()

        return { ...result, valor: Number(result.valor) } as unknown as Threshold
    }

    static async deleteThreshold(thresholdId: number, userId: number): Promise<{ message: string }> {
        const exists = await this.getThresholdById(thresholdId, userId)

        if (!exists) {
            throw createErrorResponse("Threshold não encontrado.", 404)
        }

        await db.delete(thresholds).where(eq(thresholds.id, thresholdId))

        return { message: "Limite removido com sucesso." }
    }

    static async getThresholdAlerts(userId: number, month?: number, year?: number): Promise<ThresholdAlert[]> {
        const now = new Date()
        const targetMonth = month || (now.getMonth() + 1)
        const targetYear = year || now.getFullYear()

        const queryResult = await db.execute(sql`
            SELECT
                t.id as threshold_id,
                t.valor as limit_value,
                c.nome as category_name,
                c.cor as category_color,
                COALESCE(SUM(e.quantidade), 0) as current_spending
            FROM thresholds t
            JOIN categories c ON t.category_id = c.id
            LEFT JOIN expenses e ON e.category_id = t.category_id
                AND e.user_id = t.user_id
                AND EXTRACT(MONTH FROM e.data) = ${targetMonth}
                AND EXTRACT(YEAR FROM e.data) = ${targetYear}
            WHERE t.user_id = ${userId}
            GROUP BY t.id, t.valor, c.nome, c.cor
            ORDER BY c.nome
        `)

        const result = queryResult.rows as unknown as Array<{
            threshold_id: number
            limit_value: string
            category_name: string
            category_color: string
            current_spending: string
        }>

        return result.map((row) => {
            const limitValue = Number(row.limit_value)
            const currentSpending = Number(row.current_spending)
            const percentageUsed = limitValue > 0 ? (currentSpending / limitValue) * 100 : 0
            const remaining = Math.max(0, limitValue - currentSpending)
            const isExceeded = currentSpending > limitValue

            let alertLevel: ThresholdAlert['alert_level'] = 'safe'
            if (isExceeded) alertLevel = 'exceeded'
            else if (percentageUsed >= 90) alertLevel = 'danger'
            else if (percentageUsed >= 75) alertLevel = 'warning'

            return {
                threshold_id: row.threshold_id,
                category_name: row.category_name,
                category_color: row.category_color,
                limit_value: limitValue,
                current_spending: currentSpending,
                percentage_used: Math.round(percentageUsed * 100) / 100,
                remaining,
                is_exceeded: isExceeded,
                alert_level: alertLevel
            }
        })
    }

    static async checkThresholdViolation(
        userId: number,
        categoryId: number,
        amount: number,
        month?: number,
        year?: number
    ): Promise<{
        would_violate: boolean
        threshold_value?: number
        current_spending?: number
        new_total?: number
        remaining?: number
    }> {
        const now = new Date()
        const targetMonth = month || (now.getMonth() + 1)
        const targetYear = year || now.getFullYear()

        const [threshold] = await db
            .select()
            .from(thresholds)
            .where(and(eq(thresholds.category_id, categoryId), eq(thresholds.user_id, userId)))
            .limit(1)

        if (!threshold) return { would_violate: false }

        const thresholdValue = Number(threshold.valor)

        const spendingResult = await db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) as current_spending
            FROM expenses
            WHERE user_id = ${userId} AND category_id = ${categoryId}
              AND EXTRACT(MONTH FROM data) = ${targetMonth}
              AND EXTRACT(YEAR FROM data) = ${targetYear}
        `)

        const currentSpending = Number(
            (spendingResult.rows[0] as { current_spending?: string } | undefined)?.current_spending || 0
        )
        const newTotal = currentSpending + amount
        const remaining = Math.max(0, thresholdValue - currentSpending)

        return {
            would_violate: newTotal > thresholdValue,
            threshold_value: thresholdValue,
            current_spending: currentSpending,
            new_total: newTotal,
            remaining
        }
    }

    static async getThresholdStats(userId: number): Promise<{
        total_thresholds: number
        categories_with_limits: number
        exceeded_this_month: number
        near_limit_count: number
        total_budget: number
        total_spent_this_month: number
    }> {
        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()

        const [statsResult] = await db
            .select({ count: count(), sum: sum(thresholds.valor) })
            .from(thresholds)
            .where(eq(thresholds.user_id, userId))

        const alertsQuery = await db.execute(sql`
            SELECT
                COUNT(CASE WHEN current_spending > limit_value THEN 1 END) as exceeded_count,
                COUNT(CASE WHEN current_spending >= limit_value * 0.75 AND current_spending <= limit_value THEN 1 END) as near_limit_count,
                COALESCE(SUM(current_spending), 0) as total_spent
            FROM (
                SELECT
                    t.valor as limit_value,
                    COALESCE(SUM(e.quantidade), 0) as current_spending
                FROM thresholds t
                LEFT JOIN expenses e ON e.category_id = t.category_id
                    AND e.user_id = t.user_id
                    AND EXTRACT(MONTH FROM e.data) = ${currentMonth}
                    AND EXTRACT(YEAR FROM e.data) = ${currentYear}
                WHERE t.user_id = ${userId}
                GROUP BY t.id, t.valor
            ) threshold_analysis
        `)

        const alerts = alertsQuery.rows[0] as {
            exceeded_count?: string | number
            near_limit_count?: string | number
            total_spent?: string
        } | undefined

        const totalThresholds = Number(statsResult?.count ?? 0)

        return {
            total_thresholds: totalThresholds,
            categories_with_limits: totalThresholds,
            exceeded_this_month: Number(alerts?.exceeded_count || 0),
            near_limit_count: Number(alerts?.near_limit_count || 0),
            total_budget: Number(statsResult?.sum || 0),
            total_spent_this_month: Number(alerts?.total_spent || 0)
        }
    }
}
