import prisma from '@/server/db/prisma'
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

        const category = await prisma.category.findFirst({
            where: { id: category_id, user_id: userId }
        })

        if (!category) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        if (category.tipo !== 'despesa') {
            throw createErrorResponse("Limites só podem ser definidos para categorias de despesa.", 400)
        }

        const result = await prisma.threshold.upsert({
            where: { user_id_category_id: { user_id: userId, category_id } },
            update: { valor },
            create: { user_id: userId, category_id, valor }
        })

        return { ...result, valor: Number(result.valor) } as unknown as Threshold
    }

    static async getThresholdsByUser(userId: number): Promise<ThresholdWithCategory[]> {
        const thresholds = await prisma.threshold.findMany({
            where: { user_id: userId },
            include: { category: true },
            orderBy: { category_id: 'asc' }
        })

        return thresholds.map((t: typeof thresholds[number]) => ({
            id: t.id,
            user_id: t.user_id,
            category_id: t.category_id,
            valor: Number(t.valor),
            created_at: t.created_at,
            updated_at: t.updated_at,
            categoria: {
                id: t.category.id,
                nome: t.category.nome,
                cor: t.category.cor,
                tipo: t.category.tipo as 'despesa' | 'receita',
            }
        }))
    }

    static async getThresholdById(thresholdId: number, userId: number): Promise<Threshold | null> {
        const threshold = await prisma.threshold.findFirst({
            where: { id: thresholdId, user_id: userId }
        })

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
            const category = await prisma.category.findFirst({
                where: { id: category_id, user_id: userId }
            })

            if (!category) {
                throw createErrorResponse("Categoria não encontrada.", 404)
            }

            if (category.tipo !== 'despesa') {
                throw createErrorResponse("Limites só podem ser definidos para categorias de despesa.", 400)
            }

            const existing = await prisma.threshold.findFirst({
                where: { category_id, user_id: userId, id: { not: thresholdId } }
            })

            if (existing) {
                throw createErrorResponse("Já existe um limite definido para esta categoria.", 409)
            }
        }

        const result = await prisma.threshold.update({
            where: { id: thresholdId },
            data: {
                ...(category_id !== undefined ? { category_id } : {}),
                ...(valor !== undefined ? { valor } : {}),
            }
        })

        return { ...result, valor: Number(result.valor) } as unknown as Threshold
    }

    static async deleteThreshold(thresholdId: number, userId: number): Promise<{ message: string }> {
        const exists = await prisma.threshold.findFirst({
            where: { id: thresholdId, user_id: userId }
        })

        if (!exists) {
            throw createErrorResponse("Threshold não encontrado.", 404)
        }

        await prisma.threshold.delete({ where: { id: thresholdId } })

        return { message: "Limite removido com sucesso." }
    }

    static async getThresholdAlerts(userId: number, month?: number, year?: number): Promise<ThresholdAlert[]> {
        const now = new Date()
        const targetMonth = month || (now.getMonth() + 1)
        const targetYear = year || now.getFullYear()

        const result = await prisma.$queryRaw<Array<{
            threshold_id: number
            limit_value: string
            category_name: string
            category_color: string
            current_spending: string
        }>>`
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
        `

        return result.map((row: { threshold_id: number; limit_value: string; category_name: string; category_color: string; current_spending: string }) => {
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

        const threshold = await prisma.threshold.findFirst({
            where: { category_id: categoryId, user_id: userId }
        })

        if (!threshold) return { would_violate: false }

        const thresholdValue = Number(threshold.valor)

        const spendingResult = await prisma.$queryRaw<Array<{ current_spending: string }>>`
            SELECT COALESCE(SUM(quantidade), 0) as current_spending
            FROM expenses
            WHERE user_id = ${userId} AND category_id = ${categoryId}
              AND EXTRACT(MONTH FROM data) = ${targetMonth}
              AND EXTRACT(YEAR FROM data) = ${targetYear}
        `

        const currentSpending = Number(spendingResult[0]?.current_spending || 0)
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

        const statsResult = await prisma.threshold.aggregate({
            where: { user_id: userId },
            _count: { id: true },
            _sum: { valor: true }
        })

        const alertsResult = await prisma.$queryRaw<Array<{
            exceeded_count: bigint
            near_limit_count: bigint
            total_spent: string
        }>>`
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
        `

        const alerts = alertsResult[0]

        return {
            total_thresholds: statsResult._count.id,
            categories_with_limits: statsResult._count.id,
            exceeded_this_month: Number(alerts?.exceeded_count || 0),
            near_limit_count: Number(alerts?.near_limit_count || 0),
            total_budget: Number(statsResult._sum.valor || 0),
            total_spent_this_month: Number(alerts?.total_spent || 0)
        }
    }
}
