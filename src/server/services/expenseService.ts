import prisma from '@/server/db/prisma'
import { Prisma } from '@prisma/client'
import {
    Expense,
    CreateExpenseRequest,
} from '@/server/types/index'
import {
    normalize,
    addMonthsSafe,
    formatDate,
    calculateCompetencia,
    createErrorResponse
} from '@/server/utils/helper'

interface ExpenseWithCategory extends Expense {
    categoria_nome?: string
    cor_categoria?: string
}

export class ExpenseService {
    static async createExpense(
        expenseData: CreateExpenseRequest,
        userId: number
    ): Promise<Expense | Expense[]> {
        const {
            metodo_pagamento,
            tipo,
            quantidade,
            fixo = false,
            data,
            parcelas,
            frequencia,
            card_id,
            category_id,
            observacoes,
        } = expenseData

        const formattedBaseDate = data || formatDate(new Date())
        const metodoNorm = normalize(metodo_pagamento)
        const isCreditCard = metodoNorm.includes("credito") && card_id && !isNaN(Number(card_id))

        if (isCreditCard) {
            return await this.handleCreditCardExpense({
                ...expenseData,
                data: formattedBaseDate
            }, userId, formattedBaseDate)
        }

        const result = await prisma.expense.create({
            data: {
                metodo_pagamento,
                tipo,
                quantidade,
                fixo,
                data: new Date(`${formattedBaseDate}T12:00:00`),
                parcelas: parcelas || null,
                frequencia: frequencia || null,
                user_id: userId,
                card_id: card_id || null,
                category_id: category_id || null,
                observacoes: observacoes || null,
            }
        })

        const baseExpense = this.mapToExpense(result)

        if (fixo) {
            await this.replicateFixedExpense(baseExpense, formattedBaseDate, userId)
        }

        return baseExpense
    }

    private static async handleCreditCardExpense(
        expenseData: CreateExpenseRequest & { data: string },
        userId: number,
        baseDateString: string
    ): Promise<Expense | Expense[]> {
        const baseDate = new Date(`${baseDateString}T12:00:00`)
        const { card_id, quantidade, parcelas, tipo } = expenseData

        const card = await prisma.card.findFirst({
            where: { id: card_id!, user_id: userId },
            select: { limite_disponivel: true, dia_vencimento: true, dias_fechamento_antes: true }
        })

        if (!card) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        if (Number(quantidade) > Number(card.limite_disponivel)) {
            throw createErrorResponse(
                `Limite insuficiente. Disponível: R$ ${Number(card.limite_disponivel).toFixed(2)}`,
                400
            )
        }

        if (parcelas && parcelas > 1) {
            return await this.handleInstallmentExpense(
                expenseData,
                userId,
                baseDate,
                card.dia_vencimento,
                card.dias_fechamento_antes
            )
        }

        const comp = calculateCompetencia(baseDate, card.dia_vencimento, card.dias_fechamento_antes)
        await this.checkIfInvoicePaid(userId, card_id!, comp.competencia_mes, comp.competencia_ano)

        const result = await prisma.expense.create({
            data: {
                metodo_pagamento: expenseData.metodo_pagamento,
                tipo,
                quantidade,
                fixo: expenseData.fixo || false,
                data: new Date(`${expenseData.data}T12:00:00`),
                parcelas: parcelas || null,
                frequencia: expenseData.frequencia || null,
                user_id: userId,
                card_id: card_id!,
                category_id: expenseData.category_id || null,
                observacoes: expenseData.observacoes || null,
                competencia_mes: comp.competencia_mes,
                competencia_ano: comp.competencia_ano,
            }
        })

        const baseExpense = this.mapToExpense(result)

        await prisma.card.update({
            where: { id: card_id! },
            data: { limite_disponivel: { decrement: Number(quantidade) } }
        })

        if (expenseData.fixo) {
            await this.replicateFixedCreditCardExpense(
                baseExpense,
                baseDate,
                userId,
                card.dia_vencimento,
                card.dias_fechamento_antes
            )
        }

        return baseExpense
    }

    private static async checkIfInvoicePaid(
        userId: number,
        cardId: number,
        mes: number,
        ano: number
    ): Promise<void> {
        const count = await prisma.cardInvoicePayment.count({
            where: { user_id: userId, card_id: cardId, competencia_mes: mes, competencia_ano: ano }
        })

        if (count > 0) {
            throw createErrorResponse(
                "Esta fatura já foi paga. Não é possível lançar despesas nessa competência.",
                400
            )
        }
    }

    private static async handleInstallmentExpense(
        expenseData: CreateExpenseRequest & { data: string },
        userId: number,
        baseDate: Date,
        dueDay: number,
        closeDaysBefore: number
    ): Promise<Expense[]> {
        const { parcelas, quantidade, tipo, card_id } = expenseData
        const valorParcela = Math.round((Number(quantidade) / Number(parcelas!)) * 100) / 100

        const parcelasData = Array.from({ length: parcelas! }, (_, i) => {
            const parcelaPurchaseDate = addMonthsSafe(baseDate, i)
            const comp = calculateCompetencia(parcelaPurchaseDate, dueDay, closeDaysBefore)
            return { index: i, purchaseDate: parcelaPurchaseDate, comp }
        })

        await Promise.all(
            parcelasData.map(({ comp }) =>
                this.checkIfInvoicePaid(userId, card_id!, comp.competencia_mes, comp.competencia_ano)
            )
        )

        const results = await prisma.$transaction(
            parcelasData.map(({ index, purchaseDate, comp }) =>
                prisma.expense.create({
                    data: {
                        metodo_pagamento: expenseData.metodo_pagamento,
                        tipo: `${tipo} (${index + 1}/${parcelas})`,
                        quantidade: valorParcela,
                        fixo: false,
                        data: new Date(`${formatDate(purchaseDate)}T12:00:00`),
                        parcelas: parcelas!,
                        frequencia: expenseData.frequencia || null,
                        user_id: userId,
                        card_id: card_id!,
                        category_id: expenseData.category_id || null,
                        observacoes: expenseData.observacoes || null,
                        competencia_mes: comp.competencia_mes,
                        competencia_ano: comp.competencia_ano,
                    }
                })
            )
        )

        await prisma.card.update({
            where: { id: card_id! },
            data: { limite_disponivel: { decrement: Number(quantidade) } }
        })

        return results.map(this.mapToExpense)
    }

    private static async replicateFixedCreditCardExpense(
        baseExpense: Expense,
        baseDate: Date,
        userId: number,
        diaVencimento: number,
        diasFechamentoAntes: number
    ): Promise<void> {
        const diaOriginal = baseDate.getDate()
        const mesOriginal = baseDate.getMonth()
        const ano = baseDate.getFullYear()
        const ehUltimoDiaMes = diaOriginal === 31

        const candidatos = []
        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const diasNoMesAlvo = new Date(ano, mes + 1, 0).getDate()
            const diaParaInserir = ehUltimoDiaMes ? diasNoMesAlvo : Math.min(diaOriginal, diasNoMesAlvo)
            const novaData = new Date(ano, mes, diaParaInserir)
            const dataRep = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaParaInserir).padStart(2, "0")}`
            const comp = calculateCompetencia(novaData, diaVencimento, diasFechamentoAntes)
            candidatos.push({ dataRep, comp })
        }

        const resultados = await Promise.all(
            candidatos.map(async ({ dataRep, comp }) => {
                const jaFoiPaga = await prisma.cardInvoicePayment.count({
                    where: {
                        user_id: userId,
                        card_id: baseExpense.card_id!,
                        competencia_mes: comp.competencia_mes,
                        competencia_ano: comp.competencia_ano
                    }
                })
                return jaFoiPaga === 0 ? { dataRep, comp } : null
            })
        )

        const replicasData = resultados
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .map(({ dataRep, comp }) => ({
                metodo_pagamento: baseExpense.metodo_pagamento,
                tipo: baseExpense.tipo,
                quantidade: baseExpense.quantidade,
                fixo: true,
                data: new Date(`${dataRep}T12:00:00`),
                parcelas: baseExpense.parcelas || null,
                frequencia: baseExpense.frequencia || null,
                user_id: userId,
                card_id: baseExpense.card_id!,
                category_id: baseExpense.category_id || null,
                observacoes: baseExpense.observacoes || null,
                competencia_mes: comp.competencia_mes,
                competencia_ano: comp.competencia_ano,
            }))

        if (replicasData.length > 0) {
            await prisma.expense.createMany({ data: replicasData })
        }
    }

    private static async replicateFixedExpense(
        baseExpense: Expense,
        baseDateString: string,
        userId: number
    ): Promise<void> {
        const baseDate = new Date(`${baseDateString}T12:00:00`)
        const diaOriginal = baseDate.getDate()
        const mesOriginal = baseDate.getMonth()
        const ano = baseDate.getFullYear()
        const ehUltimoDiaMes = diaOriginal === 31

        const replicasData = []
        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const diasNoMesAlvo = new Date(ano, mes + 1, 0).getDate()
            const diaParaInserir = ehUltimoDiaMes ? diasNoMesAlvo : Math.min(diaOriginal, diasNoMesAlvo)
            const dataRep = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaParaInserir).padStart(2, "0")}`

            replicasData.push({
                metodo_pagamento: baseExpense.metodo_pagamento,
                tipo: baseExpense.tipo,
                quantidade: baseExpense.quantidade,
                fixo: true,
                data: new Date(`${dataRep}T12:00:00`),
                parcelas: baseExpense.parcelas || null,
                frequencia: baseExpense.frequencia || null,
                user_id: userId,
                card_id: baseExpense.card_id || null,
                category_id: baseExpense.category_id || null,
                observacoes: baseExpense.observacoes || null,
            })
        }

        if (replicasData.length > 0) {
            await prisma.expense.createMany({ data: replicasData })
        }
    }

    static async getExpensesByMonthYear(
        userId: number,
        month: number,
        year: number
    ): Promise<ExpenseWithCategory[]> {
        const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT
                e.*,
                c.nome AS categoria_nome,
                c.cor AS cor_categoria
            FROM expenses e
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = ${userId}
              AND EXTRACT(MONTH FROM e.data) = ${month}
              AND EXTRACT(YEAR FROM e.data) = ${year}
            ORDER BY e.data DESC
        `

        return result.map((row: Record<string, unknown>) => ({
            ...row,
            quantidade: Number(row.quantidade),
            data: row.data instanceof Date ? formatDate(row.data as Date) : row.data,
        })) as ExpenseWithCategory[]
    }

    static async getExpensesByDateRange(
        userId: number,
        startDate: string,
        endDate: string
    ): Promise<ExpenseWithCategory[]> {
        const expenses = await prisma.expense.findMany({
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

        return expenses.map((e: typeof expenses[number]) => ({
            ...this.mapToExpense(e as unknown as Record<string, unknown>),
            category_id: e.category_id ?? undefined,
            categoria_nome: e.category?.nome,
            cor_categoria: e.category?.cor,
        }))
    }

    static async getMonthlyTotal(userId: number, month: number, year: number): Promise<number> {
        const result = await prisma.$queryRaw<Array<{ total: string }>>`
            SELECT COALESCE(SUM(quantidade), 0) as total
            FROM expenses
            WHERE user_id = ${userId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `

        return Number(result[0]?.total || 0)
    }

    static async getTotalByCategory(
        userId: number,
        categoryId: number,
        month: number,
        year: number
    ): Promise<number> {
        const result = await prisma.$queryRaw<Array<{ total: string }>>`
            SELECT COALESCE(SUM(quantidade), 0) as total
            FROM expenses
            WHERE user_id = ${userId}
              AND category_id = ${categoryId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `

        return Number(result[0]?.total || 0)
    }

    static async getExpenseStats(
        userId: number,
        month: number,
        year: number,
        categoryId?: number
    ): Promise<{ total: number; fixas: number; transacoes: number; media: number }> {
        const categoryFilter = categoryId
            ? Prisma.sql`AND category_id = ${categoryId}`
            : Prisma.sql``

        const result = await prisma.$queryRaw<Array<{
            total: string
            fixas: string
            transacoes: bigint
            media: string
        }>>`
            SELECT
                COALESCE(SUM(quantidade), 0) as total,
                COALESCE(SUM(CASE WHEN fixo = true THEN quantidade END), 0) as fixas,
                COUNT(*) as transacoes,
                CASE WHEN COUNT(*) > 0 THEN COALESCE(AVG(quantidade), 0) ELSE 0 END as media
            FROM expenses
            WHERE user_id = ${userId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
              ${categoryFilter}
        `

        const stats = result[0]
        return {
            total: Number(stats.total || 0),
            fixas: Number(stats.fixas || 0),
            transacoes: Number(stats.transacoes || 0),
            media: Number(stats.media || 0)
        }
    }

    static async getExpensesByCategory(
        userId: number,
        month: number,
        year: number
    ): Promise<Array<{ id: number; nome: string; cor: string; quantidade: number; total: number; percentual: number }>> {
        const result = await prisma.$queryRaw<Array<{
            id: number
            nome: string
            cor: string
            quantidade: string
            total: string
        }>>`
            SELECT
                COALESCE(parent.id, c.id) as id,
                COALESCE(parent.nome, c.nome) as nome,
                COALESCE(parent.cor, c.cor) as cor,
                COUNT(e.id) as quantidade,
                SUM(e.quantidade) as total
            FROM expenses e
            JOIN categories c ON c.id = e.category_id
            LEFT JOIN categories parent ON parent.id = c.parent_id
            WHERE e.user_id = ${userId}
              AND EXTRACT(MONTH FROM e.data) = ${month}
              AND EXTRACT(YEAR FROM e.data) = ${year}
            GROUP BY COALESCE(parent.id, c.id), COALESCE(parent.nome, c.nome), COALESCE(parent.cor, c.cor)
            ORDER BY total DESC
        `

        const totalGeral = result.reduce((acc: number, r: { id: number; nome: string; cor: string; quantidade: string; total: string }) => acc + Number(r.total), 0)

        return result.map((row: { id: number; nome: string; cor: string; quantidade: string; total: string }) => ({
            id: row.id,
            nome: row.nome,
            cor: row.cor,
            quantidade: Number(row.quantidade),
            total: Number(row.total),
            percentual: totalGeral > 0 ? (Number(row.total) / totalGeral) * 100 : 0
        }))
    }

    static async updateExpense(
        expenseId: number,
        updateData: Partial<CreateExpenseRequest>,
        userId: number
    ): Promise<Expense> {
        const original = await prisma.expense.findFirst({
            where: { id: expenseId, user_id: userId }
        })

        if (!original) {
            throw createErrorResponse("Despesa não encontrada.", 404)
        }

        const metodoOrigNorm = normalize(original.metodo_pagamento)
        if (metodoOrigNorm.includes("credito")) {
            throw createErrorResponse("Despesas no cartão de crédito não podem ser editadas.", 400)
        }

        const updateObj: Record<string, unknown> = {}

        if (updateData.metodo_pagamento !== undefined) updateObj.metodo_pagamento = updateData.metodo_pagamento
        if (updateData.tipo !== undefined) updateObj.tipo = updateData.tipo
        if (updateData.quantidade !== undefined) updateObj.quantidade = updateData.quantidade
        if (updateData.data !== undefined) updateObj.data = new Date(`${updateData.data}T12:00:00`)
        if (updateData.fixo !== undefined) updateObj.fixo = updateData.fixo
        if (updateData.category_id !== undefined) updateObj.category_id = updateData.category_id
        if (updateData.observacoes !== undefined) updateObj.observacoes = updateData.observacoes

        if (Object.keys(updateObj).length === 0) {
            return this.mapToExpense(original)
        }

        const result = await prisma.expense.update({
            where: { id: expenseId },
            data: updateObj
        })

        return this.mapToExpense(result)
    }

    static async deleteExpense(
        expenseId: number,
        userId: number
    ): Promise<Expense | Expense[]> {
        const expense = await prisma.expense.findFirst({
            where: { id: expenseId, user_id: userId }
        })

        if (!expense) {
            throw createErrorResponse("Despesa não encontrada.", 404)
        }

        if (expense.fixo) {
            const deleted = await prisma.expense.findMany({
                where: {
                    user_id: userId,
                    tipo: expense.tipo,
                    quantidade: expense.quantidade,
                    fixo: true,
                    data: { gte: expense.data }
                }
            })

            await prisma.expense.deleteMany({
                where: {
                    user_id: userId,
                    tipo: expense.tipo,
                    quantidade: expense.quantidade,
                    fixo: true,
                    data: { gte: expense.data }
                }
            })

            return deleted.map(this.mapToExpense)
        }

        const metodoNorm = normalize(expense.metodo_pagamento)
        if (metodoNorm.includes("credito") && expense.card_id) {
            await prisma.card.update({
                where: { id: expense.card_id },
                data: { limite_disponivel: { increment: Number(expense.quantidade) } }
            })
        }

        await prisma.expense.delete({ where: { id: expenseId } })

        return this.mapToExpense(expense)
    }

    private static mapToExpense(expense: Record<string, unknown>): Expense {
        return {
            ...expense,
            quantidade: Number(expense.quantidade),
            data: expense.data instanceof Date ? formatDate(expense.data as Date) : expense.data,
        } as Expense
    }
}
