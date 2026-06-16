import { and, eq, gte, lte, desc, sql, count } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { expenses, cards, cardInvoicesPayments, categories } from '@/server/db/schema'
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

// Tipo de valores para inserção em expenses (numeric → string).
type ExpenseInsert = typeof expenses.$inferInsert

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

        const [result] = await db
            .insert(expenses)
            .values({
                metodo_pagamento,
                tipo,
                quantidade: String(quantidade),
                fixo,
                data: new Date(`${formattedBaseDate}T12:00:00`),
                parcelas: parcelas || null,
                frequencia: frequencia || null,
                user_id: userId,
                card_id: card_id || null,
                category_id: category_id || null,
                observacoes: observacoes || null,
            })
            .returning()

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

        const [card] = await db
            .select({
                limite_disponivel: cards.limite_disponivel,
                dia_vencimento: cards.dia_vencimento,
                dias_fechamento_antes: cards.dias_fechamento_antes,
            })
            .from(cards)
            .where(and(eq(cards.id, card_id!), eq(cards.user_id, userId)))
            .limit(1)

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

        const [result] = await db
            .insert(expenses)
            .values({
                metodo_pagamento: expenseData.metodo_pagamento,
                tipo,
                quantidade: String(quantidade),
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
            })
            .returning()

        const baseExpense = this.mapToExpense(result)

        await db
            .update(cards)
            .set({ limite_disponivel: sql`${cards.limite_disponivel} - ${Number(quantidade)}` })
            .where(eq(cards.id, card_id!))

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
        const [row] = await db
            .select({ c: count() })
            .from(cardInvoicesPayments)
            .where(
                and(
                    eq(cardInvoicesPayments.user_id, userId),
                    eq(cardInvoicesPayments.card_id, cardId),
                    eq(cardInvoicesPayments.competencia_mes, mes),
                    eq(cardInvoicesPayments.competencia_ano, ano)
                )
            )

        if (Number(row?.c ?? 0) > 0) {
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

        const valuesToInsert: ExpenseInsert[] = parcelasData.map(({ index, purchaseDate, comp }) => ({
            metodo_pagamento: expenseData.metodo_pagamento,
            tipo: `${tipo} (${index + 1}/${parcelas})`,
            quantidade: String(valorParcela),
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
        }))

        const results = await db.transaction(async (tx) => {
            const inserted = await tx.insert(expenses).values(valuesToInsert).returning()
            await tx
                .update(cards)
                .set({ limite_disponivel: sql`${cards.limite_disponivel} - ${Number(quantidade)}` })
                .where(eq(cards.id, card_id!))
            return inserted
        })

        return results.map((r) => this.mapToExpense(r as unknown as Record<string, unknown>))
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
                const [row] = await db
                    .select({ c: count() })
                    .from(cardInvoicesPayments)
                    .where(
                        and(
                            eq(cardInvoicesPayments.user_id, userId),
                            eq(cardInvoicesPayments.card_id, baseExpense.card_id!),
                            eq(cardInvoicesPayments.competencia_mes, comp.competencia_mes),
                            eq(cardInvoicesPayments.competencia_ano, comp.competencia_ano)
                        )
                    )
                return Number(row?.c ?? 0) === 0 ? { dataRep, comp } : null
            })
        )

        const replicasData: ExpenseInsert[] = resultados
            .filter((r): r is NonNullable<typeof r> => r !== null)
            .map(({ dataRep, comp }) => ({
                metodo_pagamento: baseExpense.metodo_pagamento,
                tipo: baseExpense.tipo,
                quantidade: String(baseExpense.quantidade),
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
            await db.insert(expenses).values(replicasData)
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

        const replicasData: ExpenseInsert[] = []
        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const diasNoMesAlvo = new Date(ano, mes + 1, 0).getDate()
            const diaParaInserir = ehUltimoDiaMes ? diasNoMesAlvo : Math.min(diaOriginal, diasNoMesAlvo)
            const dataRep = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaParaInserir).padStart(2, "0")}`

            replicasData.push({
                metodo_pagamento: baseExpense.metodo_pagamento,
                tipo: baseExpense.tipo,
                quantidade: String(baseExpense.quantidade),
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
            await db.insert(expenses).values(replicasData)
        }
    }

    static async getExpensesByMonthYear(
        userId: number,
        month: number,
        year: number
    ): Promise<ExpenseWithCategory[]> {
        const queryResult = await db.execute(sql`
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
        `)

        return (queryResult.rows as Array<Record<string, unknown>>).map((row) => ({
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
        const rows = await db
            .select({
                expense: expenses,
                categoria_nome: categories.nome,
                cor_categoria: categories.cor,
            })
            .from(expenses)
            .leftJoin(categories, eq(expenses.category_id, categories.id))
            .where(
                and(
                    eq(expenses.user_id, userId),
                    gte(expenses.data, new Date(`${startDate}T00:00:00`)),
                    lte(expenses.data, new Date(`${endDate}T23:59:59`))
                )
            )
            .orderBy(desc(expenses.data))

        return rows.map((r) => ({
            ...this.mapToExpense(r.expense as unknown as Record<string, unknown>),
            category_id: r.expense.category_id ?? undefined,
            categoria_nome: r.categoria_nome ?? undefined,
            cor_categoria: r.cor_categoria ?? undefined,
        }))
    }

    static async getMonthlyTotal(userId: number, month: number, year: number): Promise<number> {
        const queryResult = await db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) as total
            FROM expenses
            WHERE user_id = ${userId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `)

        return Number((queryResult.rows[0] as { total: string } | undefined)?.total || 0)
    }

    static async getTotalByCategory(
        userId: number,
        categoryId: number,
        month: number,
        year: number
    ): Promise<number> {
        const queryResult = await db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) as total
            FROM expenses
            WHERE user_id = ${userId}
              AND category_id = ${categoryId}
              AND EXTRACT(MONTH FROM data) = ${month}
              AND EXTRACT(YEAR FROM data) = ${year}
        `)

        return Number((queryResult.rows[0] as { total: string } | undefined)?.total || 0)
    }

    static async getExpenseStats(
        userId: number,
        month: number,
        year: number,
        categoryId?: number
    ): Promise<{ total: number; fixas: number; transacoes: number; media: number }> {
        const categoryFilter = categoryId ? sql`AND category_id = ${categoryId}` : sql``

        const queryResult = await db.execute(sql`
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
        `)

        const stats = queryResult.rows[0] as {
            total: string
            fixas: string
            transacoes: string | bigint
            media: string
        }
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
        const queryResult = await db.execute(sql`
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
        `)

        const result = queryResult.rows as unknown as Array<{
            id: number
            nome: string
            cor: string
            quantidade: string
            total: string
        }>

        const totalGeral = result.reduce((acc, r) => acc + Number(r.total), 0)

        return result.map((row) => ({
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
        const [original] = await db
            .select()
            .from(expenses)
            .where(and(eq(expenses.id, expenseId), eq(expenses.user_id, userId)))
            .limit(1)

        if (!original) {
            throw createErrorResponse("Despesa não encontrada.", 404)
        }

        const metodoOrigNorm = normalize(original.metodo_pagamento)
        if (metodoOrigNorm.includes("credito")) {
            throw createErrorResponse("Despesas no cartão de crédito não podem ser editadas.", 400)
        }

        const updateObj: Partial<ExpenseInsert> = {}

        if (updateData.metodo_pagamento !== undefined) updateObj.metodo_pagamento = updateData.metodo_pagamento
        if (updateData.tipo !== undefined) updateObj.tipo = updateData.tipo
        if (updateData.quantidade !== undefined) updateObj.quantidade = String(updateData.quantidade)
        if (updateData.data !== undefined) updateObj.data = new Date(`${updateData.data}T12:00:00`)
        if (updateData.fixo !== undefined) updateObj.fixo = updateData.fixo
        if (updateData.category_id !== undefined) updateObj.category_id = updateData.category_id
        if (updateData.observacoes !== undefined) updateObj.observacoes = updateData.observacoes

        if (Object.keys(updateObj).length === 0) {
            return this.mapToExpense(original as unknown as Record<string, unknown>)
        }

        const [result] = await db
            .update(expenses)
            .set(updateObj)
            .where(eq(expenses.id, expenseId))
            .returning()

        return this.mapToExpense(result as unknown as Record<string, unknown>)
    }

    static async deleteExpense(
        expenseId: number,
        userId: number
    ): Promise<Expense | Expense[]> {
        const [expense] = await db
            .select()
            .from(expenses)
            .where(and(eq(expenses.id, expenseId), eq(expenses.user_id, userId)))
            .limit(1)

        if (!expense) {
            throw createErrorResponse("Despesa não encontrada.", 404)
        }

        if (expense.fixo) {
            const fixedConditions = and(
                eq(expenses.user_id, userId),
                eq(expenses.tipo, expense.tipo),
                eq(expenses.quantidade, expense.quantidade),
                eq(expenses.fixo, true),
                gte(expenses.data, expense.data)
            )

            const deleted = await db.select().from(expenses).where(fixedConditions)
            await db.delete(expenses).where(fixedConditions)

            return deleted.map((d) => this.mapToExpense(d as unknown as Record<string, unknown>))
        }

        const metodoNorm = normalize(expense.metodo_pagamento)
        if (metodoNorm.includes("credito") && expense.card_id) {
            await db
                .update(cards)
                .set({ limite_disponivel: sql`${cards.limite_disponivel} + ${Number(expense.quantidade)}` })
                .where(eq(cards.id, expense.card_id))
        }

        await db.delete(expenses).where(eq(expenses.id, expenseId))

        return this.mapToExpense(expense as unknown as Record<string, unknown>)
    }

    private static mapToExpense(expense: Record<string, unknown>): Expense {
        return {
            ...expense,
            quantidade: Number(expense.quantidade),
            data: expense.data instanceof Date ? formatDate(expense.data as Date) : expense.data,
        } as Expense
    }
}
