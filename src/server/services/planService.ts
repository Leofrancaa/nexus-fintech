// @ts-nocheck
import { Prisma } from '@prisma/client'
import prisma from '@/server/db/prisma'
import {
    Plan,
    CreatePlanRequest,
    ContributionRequest,
} from '@/server/types/index'
import {
    createErrorResponse,
    isPositiveNumber,
    isValidDateString,
    sanitizeString
} from '@/server/utils/helper'

interface PlanWithProgress extends Plan {
    progresso: number
    dias_restantes: number
    is_completed: boolean
    is_overdue: boolean
    contributions_count: number
    average_contribution: number
    last_contribution_date: Date | null
}

interface PlanContribution {
    id: number
    plan_id: number
    user_id: number
    valor: number
    created_at: Date
}

export class PlanService {
    static async createPlan(
        planData: CreatePlanRequest,
        userId: number
    ): Promise<Plan> {
        const { nome, descricao, meta, prazo } = planData

        if (!nome || !meta || !prazo) {
            throw createErrorResponse("Nome, meta e prazo são obrigatórios.", 400)
        }

        if (!isPositiveNumber(meta)) {
            throw createErrorResponse("Meta deve ser um número positivo.", 400)
        }

        if (!isValidDateString(prazo)) {
            throw createErrorResponse("Prazo deve estar no formato YYYY-MM-DD.", 400)
        }

        const prazoDate = new Date(`${prazo}T23:59:59`)
        if (prazoDate <= new Date()) {
            throw createErrorResponse("Prazo deve ser uma data futura.", 400)
        }

        const existing = await prisma.plan.findFirst({
            where: { nome: nome.trim(), user_id: userId }
        })

        if (existing) {
            throw createErrorResponse("Já existe um plano com este nome.", 409)
        }

        const result = await prisma.plan.create({
            data: {
                user_id: userId,
                nome: sanitizeString(nome.trim()),
                descricao: descricao ? sanitizeString(descricao.trim()) : null,
                meta,
                prazo: new Date(`${prazo}T12:00:00`),
                status: 'Iniciando',
                total_contribuido: 0,
            }
        })

        return this.mapToPlan(result)
    }

    static async getPlansByUser(userId: number): Promise<PlanWithProgress[]> {
        try {
            const plans = await prisma.plan.findMany({
                where: { user_id: userId },
                orderBy: { created_at: 'desc' }
            })

            if (plans.length === 0) return []

            return await Promise.all(
                plans.map(async (plan) => {
                    try {
                        return await this.calculatePlanProgress(plan)
                    } catch {
                        return {
                            ...this.mapToPlan(plan),
                            progresso: 0,
                            dias_restantes: 0,
                            is_completed: false,
                            is_overdue: false,
                            contributions_count: 0,
                            average_contribution: 0,
                            last_contribution_date: null
                        }
                    }
                })
            )
        } catch (error) {
            throw createErrorResponse('Erro ao buscar planos do usuário.', 500)
        }
    }

    static async getPlanById(planId: number, userId: number): Promise<PlanWithProgress | null> {
        const plan = await prisma.plan.findFirst({
            where: { id: planId, user_id: userId }
        })

        if (!plan) return null

        return await this.calculatePlanProgress(plan)
    }

    static async updatePlan(
        planId: number,
        updateData: Partial<CreatePlanRequest>,
        userId: number
    ): Promise<Plan> {
        const { nome, descricao, meta, prazo } = updateData

        const currentPlan = await prisma.plan.findFirst({
            where: { id: planId, user_id: userId }
        })

        if (!currentPlan) {
            throw createErrorResponse("Plano não encontrado.", 404)
        }

        if (meta !== undefined && !isPositiveNumber(meta)) {
            throw createErrorResponse("Meta deve ser um número positivo.", 400)
        }

        if (prazo && !isValidDateString(prazo)) {
            throw createErrorResponse("Prazo deve estar no formato YYYY-MM-DD.", 400)
        }

        if (prazo) {
            const prazoDate = new Date(`${prazo}T23:59:59`)
            if (prazoDate <= new Date()) {
                throw createErrorResponse("Prazo deve ser uma data futura.", 400)
            }
        }

        if (nome) {
            const duplicate = await prisma.plan.findFirst({
                where: { nome: nome.trim(), user_id: userId, id: { not: planId } }
            })

            if (duplicate) {
                throw createErrorResponse("Já existe um plano com este nome.", 409)
            }
        }

        const metaEfetiva = meta !== undefined ? Number(meta) : Number(currentPlan.meta)
        const progresso = metaEfetiva > 0
            ? (Number(currentPlan.total_contribuido) / metaEfetiva) * 100
            : 0

        let newStatus: string
        if (progresso >= 100) newStatus = "Concluído"
        else if (progresso >= 80) newStatus = "Quase lá"
        else if (progresso > 0) newStatus = "Em progresso"
        else newStatus = "Iniciando"

        const result = await prisma.plan.update({
            where: { id: planId },
            data: {
                ...(nome !== undefined ? { nome: sanitizeString(nome.trim()) } : {}),
                ...(descricao !== undefined ? { descricao: descricao ? sanitizeString(descricao.trim()) : null } : {}),
                ...(meta !== undefined ? { meta } : {}),
                ...(prazo !== undefined ? { prazo: new Date(`${prazo}T12:00:00`) } : {}),
                status: newStatus,
            }
        })

        return this.mapToPlan(result)
    }

    static async deletePlan(planId: number, userId: number): Promise<{ message: string }> {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const plan = await tx.plan.findFirst({
                where: { id: planId, user_id: userId }
            })

            if (!plan) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            await tx.planContribution.deleteMany({ where: { plan_id: planId, user_id: userId } })
            await tx.plan.delete({ where: { id: planId } })
        })

        return { message: "Plano e todas suas contribuições foram removidos com sucesso." }
    }

    static async addContribution(
        planId: number,
        contributionData: ContributionRequest,
        userId: number
    ): Promise<{
        contribution: PlanContribution
        new_total: number
        progress_percentage: number
        status: string
    }> {
        const { valor } = contributionData

        if (!isPositiveNumber(valor)) {
            throw createErrorResponse("Valor da contribuição deve ser positivo.", 400)
        }

        return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const plan = await tx.plan.findFirst({
                where: { id: planId, user_id: userId }
            })

            if (!plan) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            if (plan.status === 'Concluído') {
                throw createErrorResponse("Não é possível contribuir para um plano já concluído.", 400)
            }

            const contribution = await tx.planContribution.create({
                data: { plan_id: planId, user_id: userId, valor }
            })

            const newTotal = Number(plan.total_contribuido) + Number(valor)
            const meta = Number(plan.meta)
            const progresso = (newTotal / meta) * 100

            let newStatus = "Iniciando"
            if (progresso >= 100) newStatus = "Concluído"
            else if (progresso >= 80) newStatus = "Quase lá"
            else if (progresso > 0) newStatus = "Em progresso"

            await tx.plan.update({
                where: { id: planId },
                data: { total_contribuido: newTotal, status: newStatus }
            })

            return {
                contribution: { ...contribution, valor: Number(contribution.valor) },
                new_total: newTotal,
                progress_percentage: Math.round(progresso * 100) / 100,
                status: newStatus
            }
        })
    }

    static async getPlanContributions(
        planId: number,
        userId: number,
        limit: number = 20
    ): Promise<PlanContribution[]> {
        try {
            const planExists = await prisma.plan.findFirst({
                where: { id: planId, user_id: userId }
            })

            if (!planExists) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            const contributions = await prisma.planContribution.findMany({
                where: { plan_id: planId, user_id: userId },
                take: limit,
            })

            return contributions.map(c => ({ ...c, valor: Number(c.valor) }))
        } catch (error) {
            throw error
        }
    }

    static async removeContribution(
        contributionId: number,
        userId: number
    ): Promise<{ message: string; updated_plan: Plan }> {
        return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const contribution = await tx.planContribution.findFirst({
                where: { id: contributionId, user_id: userId }
            })

            if (!contribution) {
                throw createErrorResponse("Contribuição não encontrada.", 404)
            }

            const plan = await tx.plan.findFirst({
                where: { id: contribution.plan_id, user_id: userId }
            })

            const newTotal = Math.max(0, Number(plan!.total_contribuido) - Number(contribution.valor))
            const meta = Number(plan!.meta)
            const progresso = newTotal > 0 ? (newTotal / meta) * 100 : 0

            let newStatus = "Iniciando"
            if (progresso >= 100) newStatus = "Concluído"
            else if (progresso >= 80) newStatus = "Quase lá"
            else if (progresso > 0) newStatus = "Em progresso"

            await tx.planContribution.delete({ where: { id: contributionId } })

            const updatedPlan = await tx.plan.update({
                where: { id: contribution.plan_id },
                data: { total_contribuido: newTotal, status: newStatus }
            })

            return {
                message: "Contribuição removida com sucesso.",
                updated_plan: this.mapToPlan(updatedPlan)
            }
        })
    }

    private static async calculatePlanProgress(plan: Record<string, unknown>): Promise<PlanWithProgress> {
        try {
            const meta = Number(plan.meta)
            const totalContribuido = Number(plan.total_contribuido)
            const progresso = meta > 0 ? (totalContribuido / meta) * 100 : 0

            const prazoStr = plan.prazo instanceof Date ? plan.prazo.toISOString().split('T')[0] : plan.prazo as string
            const prazoDate = new Date(`${prazoStr}T23:59:59`)
            const diasRestantes = Math.ceil((prazoDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

            const stats = await prisma.planContribution.aggregate({
                where: { plan_id: plan.id as number },
                _count: { id: true },
                _avg: { valor: true },
            })

            return {
                ...this.mapToPlan(plan),
                progresso: Math.round(progresso * 100) / 100,
                dias_restantes: Math.max(0, diasRestantes),
                is_completed: progresso >= 100,
                is_overdue: diasRestantes < 0 && progresso < 100,
                contributions_count: stats._count.id,
                average_contribution: Number(stats._avg.valor || 0),
                last_contribution_date: null
            }
        } catch {
            return {
                ...this.mapToPlan(plan),
                progresso: 0,
                dias_restantes: 0,
                is_completed: false,
                is_overdue: false,
                contributions_count: 0,
                average_contribution: 0,
                last_contribution_date: null
            }
        }
    }

    static async getPlanStats(userId: number): Promise<{
        total_plans: number
        completed_plans: number
        in_progress_plans: number
        overdue_plans: number
        total_saved: number
        total_goals: number
        completion_rate: number
    }> {
        try {
            const result = await prisma.$queryRaw<Array<{
                total_plans: bigint
                completed_plans: bigint
                in_progress_plans: bigint
                overdue_plans: bigint
                total_saved: string
                total_goals: string
            }>>`
                SELECT
                    COUNT(*) as total_plans,
                    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_plans,
                    COUNT(CASE WHEN status IN ('Em progresso', 'Quase lá') THEN 1 END) as in_progress_plans,
                    COUNT(CASE WHEN prazo < CURRENT_DATE AND status != 'Concluído' THEN 1 END) as overdue_plans,
                    COALESCE(SUM(total_contribuido), 0) as total_saved,
                    COALESCE(SUM(meta), 0) as total_goals
                FROM plans
                WHERE user_id = ${userId}
            `

            const stats = result[0]
            const totalPlans = Number(stats.total_plans || 0)
            const completedPlans = Number(stats.completed_plans || 0)
            const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0

            return {
                total_plans: totalPlans,
                completed_plans: completedPlans,
                in_progress_plans: Number(stats.in_progress_plans || 0),
                overdue_plans: Number(stats.overdue_plans || 0),
                total_saved: Number(stats.total_saved || 0),
                total_goals: Number(stats.total_goals || 0),
                completion_rate: completionRate
            }
        } catch {
            return {
                total_plans: 0, completed_plans: 0, in_progress_plans: 0,
                overdue_plans: 0, total_saved: 0, total_goals: 0, completion_rate: 0
            }
        }
    }

    private static mapToPlan(plan: Record<string, unknown>): Plan {
        return {
            ...plan,
            meta: Number(plan.meta),
            total_contribuido: Number(plan.total_contribuido),
            prazo: plan.prazo instanceof Date ? (plan.prazo as Date).toISOString().split('T')[0] : plan.prazo,
        } as Plan
    }
}
