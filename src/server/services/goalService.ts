import { and, eq, desc, sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { goals } from '@/server/db/schema'
import { createErrorResponse, isPositiveNumber } from '@/server/utils/helper'

interface Goal {
    id: number
    user_id: number
    nome: string
    valor_alvo: number
    mes: number
    ano: number
    created_at: Date
    updated_at: Date
}

interface CreateGoalRequest {
    nome: string
    valor_alvo: number
    mes: number
    ano: number
}

interface GoalWithProgress extends Goal {
    valor_atual: number
    progresso: number
}

export class GoalService {
    static async createGoal(
        goalData: CreateGoalRequest,
        userId: number
    ): Promise<Goal> {
        const { nome, valor_alvo, mes, ano } = goalData

        if (!nome || !isPositiveNumber(valor_alvo) || !mes || !ano) {
            throw createErrorResponse("Nome, valor positivo, mês e ano são obrigatórios.", 400)
        }

        if (mes < 1 || mes > 12) {
            throw createErrorResponse("Mês deve estar entre 1 e 12.", 400)
        }

        const [existing] = await db
            .select()
            .from(goals)
            .where(and(eq(goals.user_id, userId), eq(goals.mes, mes), eq(goals.ano, ano)))
            .limit(1)

        if (existing) {
            throw createErrorResponse("Já existe uma meta para este mês/ano.", 409)
        }

        const [result] = await db
            .insert(goals)
            .values({ user_id: userId, nome, valor_alvo: String(valor_alvo), mes, ano })
            .returning()

        return { ...result, valor_alvo: Number(result.valor_alvo) } as Goal
    }

    static async getGoalsByUser(userId: number, mes?: number, ano?: number): Promise<GoalWithProgress[]> {
        const conditions = [eq(goals.user_id, userId)]
        if (mes !== undefined) conditions.push(eq(goals.mes, mes))
        if (ano !== undefined) conditions.push(eq(goals.ano, ano))

        const rows = await db
            .select()
            .from(goals)
            .where(and(...conditions))
            .orderBy(desc(goals.ano), desc(goals.mes))

        return Promise.all(rows.map(async (goal) => {
            const incomeResult = await db.execute(sql`
                SELECT COALESCE(SUM(quantidade), 0) as valor_atual
                FROM incomes
                WHERE user_id = ${userId}
                  AND EXTRACT(MONTH FROM data) = ${goal.mes}
                  AND EXTRACT(YEAR FROM data) = ${goal.ano}
            `)

            const valorAlvo = Number(goal.valor_alvo)
            const valorAtual = Number(
                (incomeResult.rows[0] as { valor_atual?: string } | undefined)?.valor_atual || 0
            )
            const progresso = valorAlvo > 0 ? (valorAtual / valorAlvo) * 100 : 0

            return {
                id: goal.id,
                user_id: goal.user_id,
                nome: goal.nome,
                valor_alvo: valorAlvo,
                mes: goal.mes,
                ano: goal.ano,
                created_at: goal.created_at,
                updated_at: goal.updated_at,
                valor_atual: valorAtual,
                progresso: Math.round(progresso * 100) / 100
            }
        }))
    }

    static async getGoalById(goalId: number, userId: number): Promise<Goal | null> {
        const [goal] = await db
            .select()
            .from(goals)
            .where(and(eq(goals.id, goalId), eq(goals.user_id, userId)))
            .limit(1)

        if (!goal) return null

        return { ...goal, valor_alvo: Number(goal.valor_alvo) } as Goal
    }

    static async updateGoal(
        goalId: number,
        updateData: Partial<CreateGoalRequest>,
        userId: number
    ): Promise<Goal> {
        const { nome, valor_alvo, mes, ano } = updateData

        const exists = await this.getGoalById(goalId, userId)
        if (!exists) {
            throw createErrorResponse("Meta não encontrada.", 404)
        }

        if (valor_alvo !== undefined && !isPositiveNumber(valor_alvo)) {
            throw createErrorResponse("Valor deve ser um número positivo.", 400)
        }

        if (mes !== undefined && (mes < 1 || mes > 12)) {
            throw createErrorResponse("Mês deve estar entre 1 e 12.", 400)
        }

        if (mes !== undefined || ano !== undefined) {
            const newMes = mes ?? exists.mes
            const newAno = ano ?? exists.ano

            const [conflict] = await db
                .select()
                .from(goals)
                .where(
                    and(
                        eq(goals.user_id, userId),
                        eq(goals.mes, newMes),
                        eq(goals.ano, newAno),
                        sql`${goals.id} <> ${goalId}`
                    )
                )
                .limit(1)

            if (conflict) {
                throw createErrorResponse("Já existe uma meta para este mês/ano.", 409)
            }
        }

        const [result] = await db
            .update(goals)
            .set({
                ...(nome !== undefined ? { nome } : {}),
                ...(valor_alvo !== undefined ? { valor_alvo: String(valor_alvo) } : {}),
                ...(mes !== undefined ? { mes } : {}),
                ...(ano !== undefined ? { ano } : {}),
            })
            .where(eq(goals.id, goalId))
            .returning()

        return { ...result, valor_alvo: Number(result.valor_alvo) } as Goal
    }

    static async deleteGoal(goalId: number, userId: number): Promise<{ message: string }> {
        const exists = await this.getGoalById(goalId, userId)

        if (!exists) {
            throw createErrorResponse("Meta não encontrada.", 404)
        }

        await db.delete(goals).where(eq(goals.id, goalId))

        return { message: "Meta removida com sucesso." }
    }

    static async getGoalStats(userId: number, mes?: number, ano?: number): Promise<{
        total_goals: number
        achieved_goals: number
        in_progress_goals: number
        total_target: number
        total_achieved: number
    }> {
        const goalsList = await this.getGoalsByUser(userId, mes, ano)

        return goalsList.reduce((acc, goal) => {
            acc.total_goals++
            acc.total_target += goal.valor_alvo
            acc.total_achieved += goal.valor_atual

            if (goal.progresso >= 100) acc.achieved_goals++
            else if (goal.progresso > 0) acc.in_progress_goals++

            return acc
        }, {
            total_goals: 0,
            achieved_goals: 0,
            in_progress_goals: 0,
            total_target: 0,
            total_achieved: 0
        })
    }
}
