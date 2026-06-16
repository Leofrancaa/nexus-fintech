import { eq, and, ne, desc, sql, count, avg, max } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { plans, planContributions } from '@/server/db/schema'
import {
    Plan,
    CreatePlanRequest,
    ContributionRequest,
    AporteSimulationRequest,
    AporteSimulationResult,
} from '@/server/types/index'
import {
    createErrorResponse,
    isPositiveNumber,
    isValidDateString,
    sanitizeString
} from '@/server/utils/helper'
import { getSelicAnual } from '@/server/services/selicService'
import { calcAporteMensal, mesesAtePrazo } from '@/server/utils/finance/calcAporteMensal'

interface AporteInfo {
    aporte_mensal_necessario: number
    taxa_utilizada: number
    taxa_fonte: 'custom' | 'selic' | 'fallback'
    meses_restantes: number
}

interface PlanWithProgress extends Plan {
    progresso: number
    dias_restantes: number
    is_completed: boolean
    is_overdue: boolean
    contributions_count: number
    average_contribution: number
    last_contribution_date: Date | null
    aporte_mensal_necessario: number
    taxa_utilizada: number
    taxa_fonte: 'custom' | 'selic' | 'fallback'
    meses_restantes: number
}

interface PlanContribution {
    id: number
    plan_id: number
    user_id: number
    valor: number
    created_at: Date
}

// Calcula os status padronizados a partir do progresso (% concluído).
// Fonte única de verdade — usada também pelo frontend via campo `status`.
function statusFromProgress(progresso: number): string {
    if (progresso >= 100) return 'Concluído'
    if (progresso >= 80) return 'Quase lá'
    if (progresso > 0) return 'Em progresso'
    return 'Iniciando'
}

export class PlanService {
    static async createPlan(
        planData: CreatePlanRequest,
        userId: number
    ): Promise<Plan> {
        const { nome, descricao, meta, prazo, taxa_anual } = planData

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

        if (taxa_anual !== undefined && taxa_anual !== null && !isPositiveNumber(taxa_anual)) {
            throw createErrorResponse("Taxa anual deve ser um número positivo.", 400)
        }

        const existing = await db
            .select()
            .from(plans)
            .where(and(eq(plans.nome, nome.trim()), eq(plans.user_id, userId)))
            .limit(1)

        if (existing[0]) {
            throw createErrorResponse("Já existe um plano com este nome.", 409)
        }

        const [result] = await db
            .insert(plans)
            .values({
                user_id: userId,
                nome: sanitizeString(nome.trim()),
                descricao: descricao ? sanitizeString(descricao.trim()) : null,
                meta: String(meta),
                prazo: new Date(`${prazo}T12:00:00`),
                status: 'Iniciando',
                total_contribuido: '0',
                taxa_anual:
                    taxa_anual !== undefined && taxa_anual !== null ? String(taxa_anual) : null,
            })
            .returning()

        return this.mapToPlan(result)
    }

    static async getPlansByUser(userId: number): Promise<PlanWithProgress[]> {
        try {
            const rows = await db
                .select()
                .from(plans)
                .where(eq(plans.user_id, userId))
                .orderBy(desc(plans.created_at))

            if (rows.length === 0) return []

            // Selic buscada uma única vez (cacheada) e reutilizada em todos os planos.
            const selic = await getSelicAnual()

            return await Promise.all(
                rows.map(async (plan) => {
                    try {
                        return await this.calculatePlanProgress(plan, selic)
                    } catch {
                        return this.emptyProgress(plan)
                    }
                })
            )
        } catch {
            throw createErrorResponse('Erro ao buscar planos do usuário.', 500)
        }
    }

    static async getPlanById(planId: number, userId: number): Promise<PlanWithProgress | null> {
        const [plan] = await db
            .select()
            .from(plans)
            .where(and(eq(plans.id, planId), eq(plans.user_id, userId)))
            .limit(1)

        if (!plan) return null

        return await this.calculatePlanProgress(plan)
    }

    static async updatePlan(
        planId: number,
        updateData: Partial<CreatePlanRequest>,
        userId: number
    ): Promise<Plan> {
        const { nome, descricao, meta, prazo, taxa_anual } = updateData

        const [currentPlan] = await db
            .select()
            .from(plans)
            .where(and(eq(plans.id, planId), eq(plans.user_id, userId)))
            .limit(1)

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

        if (taxa_anual !== undefined && taxa_anual !== null && !isPositiveNumber(taxa_anual)) {
            throw createErrorResponse("Taxa anual deve ser um número positivo.", 400)
        }

        if (nome) {
            const duplicate = await db
                .select()
                .from(plans)
                .where(
                    and(
                        eq(plans.nome, nome.trim()),
                        eq(plans.user_id, userId),
                        ne(plans.id, planId)
                    )
                )
                .limit(1)

            if (duplicate[0]) {
                throw createErrorResponse("Já existe um plano com este nome.", 409)
            }
        }

        const metaEfetiva = meta !== undefined ? Number(meta) : Number(currentPlan.meta)
        const progresso = metaEfetiva > 0
            ? (Number(currentPlan.total_contribuido) / metaEfetiva) * 100
            : 0

        const newStatus = statusFromProgress(progresso)

        const [result] = await db
            .update(plans)
            .set({
                ...(nome !== undefined ? { nome: sanitizeString(nome.trim()) } : {}),
                ...(descricao !== undefined
                    ? { descricao: descricao ? sanitizeString(descricao.trim()) : null }
                    : {}),
                ...(meta !== undefined ? { meta: String(meta) } : {}),
                ...(prazo !== undefined ? { prazo: new Date(`${prazo}T12:00:00`) } : {}),
                ...(taxa_anual !== undefined
                    ? { taxa_anual: taxa_anual !== null ? String(taxa_anual) : null }
                    : {}),
                status: newStatus,
            })
            .where(eq(plans.id, planId))
            .returning()

        return this.mapToPlan(result)
    }

    static async deletePlan(planId: number, userId: number): Promise<{ message: string }> {
        await db.transaction(async (tx) => {
            const [plan] = await tx
                .select()
                .from(plans)
                .where(and(eq(plans.id, planId), eq(plans.user_id, userId)))
                .limit(1)

            if (!plan) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            await tx
                .delete(planContributions)
                .where(
                    and(
                        eq(planContributions.plan_id, planId),
                        eq(planContributions.user_id, userId)
                    )
                )
            await tx.delete(plans).where(eq(plans.id, planId))
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
        aporte_mensal_necessario: number
    }> {
        const { valor } = contributionData

        if (!isPositiveNumber(valor)) {
            throw createErrorResponse("Valor da contribuição deve ser positivo.", 400)
        }

        const selic = await getSelicAnual()

        return await db.transaction(async (tx) => {
            const [plan] = await tx
                .select()
                .from(plans)
                .where(and(eq(plans.id, planId), eq(plans.user_id, userId)))
                .limit(1)

            if (!plan) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            if (plan.status === 'Concluído') {
                throw createErrorResponse("Não é possível contribuir para um plano já concluído.", 400)
            }

            const [contribution] = await tx
                .insert(planContributions)
                .values({ plan_id: planId, user_id: userId, valor: String(valor) })
                .returning()

            const newTotal = Number(plan.total_contribuido) + Number(valor)
            const meta = Number(plan.meta)
            const progresso = meta > 0 ? (newTotal / meta) * 100 : 0
            const newStatus = statusFromProgress(progresso)

            await tx
                .update(plans)
                .set({ total_contribuido: String(newTotal), status: newStatus })
                .where(eq(plans.id, planId))

            const aporte = this.computeAporte(
                meta,
                newTotal,
                plan.prazo,
                plan.taxa_anual,
                selic
            )

            return {
                contribution: { ...contribution, valor: Number(contribution.valor) },
                new_total: newTotal,
                progress_percentage: Math.round(progresso * 100) / 100,
                status: newStatus,
                aporte_mensal_necessario: aporte.aporte_mensal_necessario,
            }
        })
    }

    static async getPlanContributions(
        planId: number,
        userId: number,
        limit: number = 20
    ): Promise<PlanContribution[]> {
        const [planExists] = await db
            .select()
            .from(plans)
            .where(and(eq(plans.id, planId), eq(plans.user_id, userId)))
            .limit(1)

        if (!planExists) {
            throw createErrorResponse("Plano não encontrado.", 404)
        }

        const contributions = await db
            .select()
            .from(planContributions)
            .where(
                and(
                    eq(planContributions.plan_id, planId),
                    eq(planContributions.user_id, userId)
                )
            )
            .orderBy(desc(planContributions.created_at))
            .limit(limit)

        return contributions.map((c) => ({ ...c, valor: Number(c.valor) }))
    }

    static async removeContribution(
        contributionId: number,
        userId: number
    ): Promise<{ message: string; updated_plan: Plan; aporte_mensal_necessario: number }> {
        const selic = await getSelicAnual()

        return await db.transaction(async (tx) => {
            const [contribution] = await tx
                .select()
                .from(planContributions)
                .where(
                    and(
                        eq(planContributions.id, contributionId),
                        eq(planContributions.user_id, userId)
                    )
                )
                .limit(1)

            if (!contribution) {
                throw createErrorResponse("Contribuição não encontrada.", 404)
            }

            const [plan] = await tx
                .select()
                .from(plans)
                .where(and(eq(plans.id, contribution.plan_id), eq(plans.user_id, userId)))
                .limit(1)

            if (!plan) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            const newTotal = Math.max(
                0,
                Number(plan.total_contribuido) - Number(contribution.valor)
            )
            const meta = Number(plan.meta)
            const progresso = meta > 0 && newTotal > 0 ? (newTotal / meta) * 100 : 0
            const newStatus = statusFromProgress(progresso)

            await tx
                .delete(planContributions)
                .where(eq(planContributions.id, contributionId))

            const [updatedPlan] = await tx
                .update(plans)
                .set({ total_contribuido: String(newTotal), status: newStatus })
                .where(eq(plans.id, contribution.plan_id))
                .returning()

            const aporte = this.computeAporte(
                meta,
                newTotal,
                plan.prazo,
                plan.taxa_anual,
                selic
            )

            return {
                message: "Contribuição removida com sucesso.",
                updated_plan: this.mapToPlan(updatedPlan),
                aporte_mensal_necessario: aporte.aporte_mensal_necessario,
            }
        })
    }

    /**
     * Simula o aporte mensal necessário sem persistir o plano.
     */
    static async simulateAporte(
        data: AporteSimulationRequest
    ): Promise<AporteSimulationResult> {
        const { meta, prazo, taxa_anual } = data

        if (!isPositiveNumber(meta)) {
            throw createErrorResponse("Meta deve ser um número positivo.", 400)
        }
        if (!isValidDateString(prazo)) {
            throw createErrorResponse("Prazo deve estar no formato YYYY-MM-DD.", 400)
        }
        if (taxa_anual !== undefined && taxa_anual !== null && !isPositiveNumber(taxa_anual)) {
            throw createErrorResponse("Taxa anual deve ser um número positivo.", 400)
        }

        const selic = await getSelicAnual()
        const info = this.computeAporte(
            Number(meta),
            0,
            new Date(`${prazo}T12:00:00`),
            taxa_anual !== undefined && taxa_anual !== null ? String(taxa_anual) : null,
            selic
        )

        return {
            aporte_mensal: info.aporte_mensal_necessario,
            taxa_utilizada: info.taxa_utilizada,
            taxa_fonte: info.taxa_fonte,
            meses_restantes: info.meses_restantes,
        }
    }

    // Centraliza a escolha de taxa (custom vs Selic) e o cálculo do aporte mensal.
    private static computeAporte(
        meta: number,
        totalContribuido: number,
        prazo: Date | string,
        taxaAnualCustom: string | number | null | undefined,
        selic: { valor: number; fonte: 'bcb' | 'fallback' }
    ): AporteInfo {
        const hasCustom =
            taxaAnualCustom !== null &&
            taxaAnualCustom !== undefined &&
            Number(taxaAnualCustom) > 0

        const taxaUtilizada = hasCustom ? Number(taxaAnualCustom) : selic.valor
        const taxaFonte: 'custom' | 'selic' | 'fallback' = hasCustom
            ? 'custom'
            : selic.fonte === 'bcb'
              ? 'selic'
              : 'fallback'

        const mesesRestantes = mesesAtePrazo(prazo)
        const { aporteMensal } = calcAporteMensal({
            meta,
            totalContribuido,
            mesesRestantes,
            taxaAnual: taxaUtilizada,
        })

        return {
            aporte_mensal_necessario: aporteMensal,
            taxa_utilizada: taxaUtilizada,
            taxa_fonte: taxaFonte,
            meses_restantes: mesesRestantes,
        }
    }

    private static async calculatePlanProgress(
        plan: typeof plans.$inferSelect,
        selicPrefetched?: { valor: number; fonte: 'bcb' | 'fallback' }
    ): Promise<PlanWithProgress> {
        const meta = Number(plan.meta)
        const totalContribuido = Number(plan.total_contribuido)
        const progresso = meta > 0 ? (totalContribuido / meta) * 100 : 0

        const prazoDate = plan.prazo instanceof Date ? plan.prazo : new Date(`${plan.prazo}T23:59:59`)
        const diasRestantes = Math.ceil(
            (new Date(`${prazoDate.toISOString().split('T')[0]}T23:59:59`).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
        )

        const [stats] = await db
            .select({
                count: count(),
                avg: avg(planContributions.valor),
                last: max(planContributions.created_at),
            })
            .from(planContributions)
            .where(eq(planContributions.plan_id, plan.id))

        const selic = selicPrefetched ?? (await getSelicAnual())
        const aporte = this.computeAporte(meta, totalContribuido, plan.prazo, plan.taxa_anual, selic)

        return {
            ...this.mapToPlan(plan),
            progresso: Math.round(progresso * 100) / 100,
            dias_restantes: Math.max(0, diasRestantes),
            is_completed: progresso >= 100,
            is_overdue: diasRestantes < 0 && progresso < 100,
            contributions_count: Number(stats?.count ?? 0),
            average_contribution: Number(stats?.avg ?? 0),
            last_contribution_date: (stats?.last as Date | null) ?? null,
            ...aporte,
        }
    }

    private static emptyProgress(plan: typeof plans.$inferSelect): PlanWithProgress {
        return {
            ...this.mapToPlan(plan),
            progresso: 0,
            dias_restantes: 0,
            is_completed: false,
            is_overdue: false,
            contributions_count: 0,
            average_contribution: 0,
            last_contribution_date: null,
            aporte_mensal_necessario: 0,
            taxa_utilizada: 0,
            taxa_fonte: 'fallback',
            meses_restantes: 0,
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
            const result = await db.execute(sql`
                SELECT
                    COUNT(*) as total_plans,
                    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_plans,
                    COUNT(CASE WHEN status IN ('Em progresso', 'Quase lá') THEN 1 END) as in_progress_plans,
                    COUNT(CASE WHEN prazo < CURRENT_DATE AND status != 'Concluído' THEN 1 END) as overdue_plans,
                    COALESCE(SUM(total_contribuido), 0) as total_saved,
                    COALESCE(SUM(meta), 0) as total_goals
                FROM plans
                WHERE user_id = ${userId}
            `)

            const stats = (result.rows[0] ?? {}) as Record<string, unknown>
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

    private static mapToPlan(plan: typeof plans.$inferSelect): Plan {
        return {
            ...plan,
            descricao: plan.descricao ?? undefined,
            meta: Number(plan.meta),
            total_contribuido: Number(plan.total_contribuido),
            taxa_anual: plan.taxa_anual !== null ? Number(plan.taxa_anual) : null,
            prazo:
                plan.prazo instanceof Date
                    ? plan.prazo.toISOString().split('T')[0]
                    : plan.prazo,
        } as Plan
    }
}
