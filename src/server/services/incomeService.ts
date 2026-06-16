import { and, eq, gte, lte, desc, sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { incomes, categories } from '@/server/db/schema'
import {
    Income,
    CreateIncomeRequest,
} from '@/server/types/index'
import {
    formatDate,
    getLastDayOfMonth,
    createErrorResponse
} from '@/server/utils/helper'

interface IncomeWithCategory extends Income {
    categoria_nome?: string
    cor_categoria?: string
}

interface IncomeStatsResult {
    total: string
    fixas: string
    transacoes: string
    media: string
}

export class IncomeService {
    static async createIncome(
        incomeData: CreateIncomeRequest,
        userId: number
    ): Promise<Income | Income[]> {
        const {
            tipo,
            quantidade,
            nota,
            data,
            fonte,
            fixo = false,
            category_id
        } = incomeData

        const formattedBaseDate = data || formatDate(new Date())

        const [result] = await db
            .insert(incomes)
            .values({
                tipo,
                quantidade: String(quantidade),
                nota: nota || null,
                data: new Date(`${formattedBaseDate}T12:00:00`),
                fonte: fonte || null,
                fixo,
                user_id: userId,
                category_id: category_id || null,
            })
            .returning()

        const baseIncome = this.mapToIncome(result)

        if (fixo) {
            const replicatedIncomes = await this.replicateFixedIncome(baseIncome, formattedBaseDate, userId)
            return [baseIncome, ...replicatedIncomes]
        }

        return baseIncome
    }

    private static async replicateFixedIncome(
        baseIncome: Income,
        baseDateString: string,
        userId: number
    ): Promise<Income[]> {
        const baseDate = new Date(`${baseDateString}T12:00:00`)
        const diaOriginal = baseDate.getDate()
        const mesOriginal = baseDate.getMonth()
        const ano = baseDate.getFullYear()
        const ehUltimoDiaMes = diaOriginal === 31

        const replicatedIncomes: Income[] = []

        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const novaData = new Date(ano, mes, 1)
            const ultimoDiaDoMes = getLastDayOfMonth(novaData)

            const diaAjustado = ehUltimoDiaMes ? ultimoDiaDoMes : Math.min(diaOriginal, ultimoDiaDoMes)
            const dataRep = formatDate(new Date(ano, mes, diaAjustado))

            const [result] = await db
                .insert(incomes)
                .values({
                    tipo: baseIncome.tipo,
                    quantidade: String(baseIncome.quantidade),
                    nota: baseIncome.nota || null,
                    data: new Date(`${dataRep}T12:00:00`),
                    fonte: baseIncome.fonte || null,
                    fixo: true,
                    user_id: userId,
                    category_id: baseIncome.category_id || null,
                })
                .returning()

            replicatedIncomes.push(this.mapToIncome(result))
        }

        return replicatedIncomes
    }

    static async getIncomesByDateRange(
        userId: number,
        startDate: string,
        endDate: string
    ): Promise<IncomeWithCategory[]> {
        const rows = await db
            .select({
                income: incomes,
                categoria_nome: categories.nome,
                cor_categoria: categories.cor,
            })
            .from(incomes)
            .leftJoin(categories, eq(incomes.category_id, categories.id))
            .where(
                and(
                    eq(incomes.user_id, userId),
                    gte(incomes.data, new Date(`${startDate}T00:00:00`)),
                    lte(incomes.data, new Date(`${endDate}T23:59:59`))
                )
            )
            .orderBy(desc(incomes.data))

        return rows.map((r) => ({
            ...this.mapToIncome(r.income as unknown as Record<string, unknown>),
            categoria_nome: r.categoria_nome ?? undefined,
            cor_categoria: r.cor_categoria ?? undefined,
        }))
    }

    static async getIncomesByMonthYear(
        userId: number,
        month: number,
        year: number
    ): Promise<IncomeWithCategory[]> {
        const queryResult = await db.execute(sql`
            SELECT
                i.*,
                c.nome AS categoria_nome,
                c.cor AS cor_categoria
            FROM incomes i
            LEFT JOIN categories c ON i.category_id = c.id
            WHERE i.user_id = ${userId}
              AND EXTRACT(MONTH FROM i.data) = ${month}
              AND EXTRACT(YEAR FROM i.data) = ${year}
            ORDER BY i.data DESC
        `)

        return (queryResult.rows as Array<Record<string, unknown>>).map((row) => ({
            ...row,
            quantidade: Number(row.quantidade),
            data: row.data instanceof Date ? formatDate(row.data as Date) : row.data,
        })) as IncomeWithCategory[]
    }

    static async updateIncome(
        incomeId: number,
        updateData: Partial<CreateIncomeRequest>,
        userId: number
    ): Promise<Income> {
        const [exists] = await db
            .select()
            .from(incomes)
            .where(and(eq(incomes.id, incomeId), eq(incomes.user_id, userId)))
            .limit(1)

        if (!exists) {
            throw createErrorResponse("Receita não encontrada.", 404)
        }

        const setData = {
            ...(updateData.tipo !== undefined ? { tipo: updateData.tipo } : {}),
            ...(updateData.quantidade !== undefined ? { quantidade: String(updateData.quantidade) } : {}),
            ...(updateData.nota !== undefined ? { nota: updateData.nota } : {}),
            ...(updateData.data !== undefined ? { data: new Date(`${updateData.data}T12:00:00`) } : {}),
            ...(updateData.fonte !== undefined ? { fonte: updateData.fonte } : {}),
            ...(updateData.category_id !== undefined ? { category_id: updateData.category_id } : {}),
        }

        if (Object.keys(setData).length === 0) {
            return this.mapToIncome(exists as unknown as Record<string, unknown>)
        }

        const [result] = await db
            .update(incomes)
            .set(setData)
            .where(eq(incomes.id, incomeId))
            .returning()

        return this.mapToIncome(result)
    }

    static async deleteIncome(incomeId: number, userId: number): Promise<Income | Income[]> {
        const [income] = await db
            .select()
            .from(incomes)
            .where(and(eq(incomes.id, incomeId), eq(incomes.user_id, userId)))
            .limit(1)

        if (!income) {
            throw createErrorResponse("Receita não encontrada.", 404)
        }

        if (income.fixo) {
            const deleted = await db
                .select()
                .from(incomes)
                .where(
                    and(
                        eq(incomes.user_id, userId),
                        eq(incomes.tipo, income.tipo),
                        eq(incomes.fixo, true)
                    )
                )

            await db
                .delete(incomes)
                .where(
                    and(
                        eq(incomes.user_id, userId),
                        eq(incomes.tipo, income.tipo),
                        eq(incomes.fixo, true)
                    )
                )

            return deleted.map((d) => this.mapToIncome(d as unknown as Record<string, unknown>))
        }

        await db.delete(incomes).where(eq(incomes.id, incomeId))

        return this.mapToIncome(income as unknown as Record<string, unknown>)
    }

    static async getIncomeStats(
        userId: number,
        month: number,
        year: number,
        categoryId?: number | undefined
    ): Promise<IncomeStatsResult> {
        const categoryFilter = categoryId ? sql`AND category_id = ${categoryId}` : sql``

        const queryResult = await db.execute(sql`
            SELECT
                COALESCE(SUM(quantidade), 0) AS total,
                COALESCE(SUM(CASE WHEN fixo = true THEN quantidade ELSE 0 END), 0) AS fixas,
                COUNT(*) AS transacoes,
                COALESCE(AVG(quantidade), 0) AS media
            FROM incomes
            WHERE user_id = ${userId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
              ${categoryFilter}
        `)

        return queryResult.rows[0] as unknown as IncomeStatsResult
    }

    static async getMonthlyTotal(userId: number, month: number, year: number): Promise<number> {
        const queryResult = await db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM incomes
            WHERE user_id = ${userId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `)

        return parseFloat((queryResult.rows[0] as { total: string }).total)
    }

    static async getTotalByCategory(
        userId: number,
        categoryId: number,
        month: number,
        year: number
    ): Promise<number> {
        const queryResult = await db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM incomes
            WHERE user_id = ${userId}
              AND category_id = ${categoryId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `)

        return parseFloat((queryResult.rows[0] as { total: string }).total)
    }

    static async getIncomesGroupedByMonth(userId: number): Promise<Array<{ mes: string; total: number }>> {
        const queryResult = await db.execute(sql`
            SELECT
                EXTRACT(MONTH FROM data) AS numero_mes,
                SUM(quantidade) AS total
            FROM incomes
            WHERE user_id = ${userId}
            GROUP BY numero_mes
            ORDER BY numero_mes
        `)

        const result = queryResult.rows as unknown as Array<{ numero_mes: number; total: string }>
        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

        return meses.map((mes, index) => {
            const encontrado = result.find((r) => Number(r.numero_mes) === index + 1)
            return { mes, total: encontrado ? Number(encontrado.total) : 0 }
        })
    }

    static async getCategoryResume(
        userId: number,
        month: number,
        year: number
    ): Promise<Array<{
        nome: string
        cor: string
        quantidade: number
        total: number
        percentual: number
    }>> {
        const queryResult = await db.execute(sql`
            SELECT
                c.nome,
                c.cor,
                COUNT(i.id) as quantidade,
                SUM(i.quantidade) as total
            FROM incomes i
            JOIN categories c ON c.id = i.category_id
            WHERE i.user_id = ${userId}
              AND EXTRACT(MONTH FROM i.data) = ${month}
              AND EXTRACT(YEAR FROM i.data) = ${year}
            GROUP BY c.nome, c.cor
        `)

        const result = queryResult.rows as unknown as Array<{
            nome: string
            cor: string
            quantidade: string
            total: string
        }>

        const totalGeral = result.reduce((acc, r) => acc + Number(r.total), 0)

        return result.map((r) => ({
            nome: r.nome,
            cor: r.cor,
            quantidade: Number(r.quantidade),
            total: Number(r.total),
            percentual: totalGeral > 0 ? (Number(r.total) / totalGeral) * 100 : 0,
        }))
    }

    private static mapToIncome(row: Record<string, unknown>): Income {
        return {
            ...row,
            quantidade: Number(row.quantidade),
            data: row.data instanceof Date ? formatDate(row.data as Date) : row.data,
        } as Income
    }
}
