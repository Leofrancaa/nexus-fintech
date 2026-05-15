import prisma from '@/server/db/prisma'
import { Prisma } from '@prisma/client'
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

        const result = await prisma.income.create({
            data: {
                tipo,
                quantidade,
                nota: nota || null,
                data: new Date(`${formattedBaseDate}T12:00:00`),
                fonte: fonte || null,
                fixo,
                user_id: userId,
                category_id: category_id || null,
            }
        })

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

            const result = await prisma.income.create({
                data: {
                    tipo: baseIncome.tipo,
                    quantidade: baseIncome.quantidade,
                    nota: baseIncome.nota || null,
                    data: new Date(`${dataRep}T12:00:00`),
                    fonte: baseIncome.fonte || null,
                    fixo: true,
                    user_id: userId,
                    category_id: baseIncome.category_id || null,
                }
            })

            replicatedIncomes.push(this.mapToIncome(result))
        }

        return replicatedIncomes
    }

    static async getIncomesByDateRange(
        userId: number,
        startDate: string,
        endDate: string
    ): Promise<IncomeWithCategory[]> {
        const incomes = await prisma.income.findMany({
            where: {
                user_id: userId,
                data: {
                    gte: new Date(`${startDate}T00:00:00`),
                    lte: new Date(`${endDate}T23:59:59`),
                }
            },
            include: { category: true },
            orderBy: { data: 'desc' }
        })

        return incomes.map((i: typeof incomes[number]) => ({
            ...this.mapToIncome(i as unknown as Record<string, unknown>),
            categoria_nome: i.category?.nome,
            cor_categoria: i.category?.cor,
        }))
    }

    static async getIncomesByMonthYear(
        userId: number,
        month: number,
        year: number
    ): Promise<IncomeWithCategory[]> {
        const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
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
        `

        return result.map((row: Record<string, unknown>) => ({
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
        const exists = await prisma.income.findFirst({
            where: { id: incomeId, user_id: userId }
        })

        if (!exists) {
            throw createErrorResponse("Receita não encontrada.", 404)
        }

        const result = await prisma.income.update({
            where: { id: incomeId },
            data: {
                ...(updateData.tipo !== undefined ? { tipo: updateData.tipo } : {}),
                ...(updateData.quantidade !== undefined ? { quantidade: updateData.quantidade } : {}),
                ...(updateData.nota !== undefined ? { nota: updateData.nota } : {}),
                ...(updateData.data !== undefined ? { data: new Date(`${updateData.data}T12:00:00`) } : {}),
                ...(updateData.fonte !== undefined ? { fonte: updateData.fonte } : {}),
                ...(updateData.category_id !== undefined ? { category_id: updateData.category_id } : {}),
            }
        })

        return this.mapToIncome(result)
    }

    static async deleteIncome(incomeId: number, userId: number): Promise<Income | Income[]> {
        const income = await prisma.income.findFirst({
            where: { id: incomeId, user_id: userId }
        })

        if (!income) {
            throw createErrorResponse("Receita não encontrada.", 404)
        }

        if (income.fixo) {
            const deleted = await prisma.income.findMany({
                where: { user_id: userId, tipo: income.tipo, fixo: true }
            })

            await prisma.income.deleteMany({
                where: { user_id: userId, tipo: income.tipo, fixo: true }
            })

            return deleted.map(this.mapToIncome)
        }

        await prisma.income.delete({ where: { id: incomeId } })

        return this.mapToIncome(income)
    }

    static async getIncomeStats(
        userId: number,
        month: number,
        year: number,
        categoryId?: number | undefined
    ): Promise<IncomeStatsResult> {
        const categoryFilter = categoryId
            ? Prisma.sql`AND category_id = ${categoryId}`
            : Prisma.sql``

        const result = await prisma.$queryRaw<Array<IncomeStatsResult>>`
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
        `

        return result[0]
    }

    static async getMonthlyTotal(userId: number, month: number, year: number): Promise<number> {
        const result = await prisma.$queryRaw<Array<{ total: string }>>`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM incomes
            WHERE user_id = ${userId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `

        return parseFloat(result[0].total)
    }

    static async getTotalByCategory(
        userId: number,
        categoryId: number,
        month: number,
        year: number
    ): Promise<number> {
        const result = await prisma.$queryRaw<Array<{ total: string }>>`
            SELECT COALESCE(SUM(quantidade), 0) AS total
            FROM incomes
            WHERE user_id = ${userId}
              AND category_id = ${categoryId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `

        return parseFloat(result[0].total)
    }

    static async getIncomesGroupedByMonth(userId: number): Promise<Array<{ mes: string; total: number }>> {
        const result = await prisma.$queryRaw<Array<{ numero_mes: number; total: string }>>`
            SELECT
                EXTRACT(MONTH FROM data) AS numero_mes,
                SUM(quantidade) AS total
            FROM incomes
            WHERE user_id = ${userId}
            GROUP BY numero_mes
            ORDER BY numero_mes
        `

        const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

        return meses.map((mes, index) => {
            const encontrado = result.find((r: { numero_mes: number; total: string }) => Number(r.numero_mes) === index + 1)
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
        const result = await prisma.$queryRaw<Array<{
            nome: string
            cor: string
            quantidade: string
            total: string
        }>>`
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
        `

        const totalGeral = result.reduce((acc: number, r: { nome: string; cor: string; quantidade: string; total: string }) => acc + Number(r.total), 0)

        return result.map((r: { nome: string; cor: string; quantidade: string; total: string }) => ({
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
