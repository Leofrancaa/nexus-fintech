import { and, eq, desc, sql, sum } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { cards, expenses, cardInvoicesPayments } from '@/server/db/schema'
import {
    createErrorResponse
} from '@/server/utils/helper'

interface PayInvoiceParams {
    user_id: number
    card_id: number
    mes?: number
    ano?: number
}

interface PayInvoiceResult {
    competencia_mes: number
    competencia_ano: number
    total_devolvido: number
    fechamento_em: Date
}

export class CardInvoiceService {
    static async payCardInvoice(params: PayInvoiceParams): Promise<PayInvoiceResult> {
        const { user_id, card_id, mes, ano } = params

        const [card] = await db
            .select({
                dia_vencimento: cards.dia_vencimento,
                dias_fechamento_antes: cards.dias_fechamento_antes,
                limite_disponivel: cards.limite_disponivel,
            })
            .from(cards)
            .where(and(eq(cards.id, card_id), eq(cards.user_id, user_id)))
            .limit(1)

        if (!card) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        const dueDay = Number(card.dia_vencimento)
        const closeBefore = Number(card.dias_fechamento_antes ?? 10)

        let competencia_mes = mes ? Number(mes) : null
        let competencia_ano = ano ? Number(ano) : null

        const now = new Date()
        if (!competencia_mes || !competencia_ano) {
            const thisMonthDue = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, 28))
            const nextDue = (now <= thisMonthDue)
                ? thisMonthDue
                : new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dueDay, 28))

            competencia_mes = nextDue.getMonth() + 1
            competencia_ano = nextDue.getFullYear()
        }

        const dueDate = new Date(competencia_ano, competencia_mes - 1, Math.min(dueDay, 28))
        const closeDate = new Date(dueDate)
        closeDate.setDate(closeDate.getDate() - closeBefore)

        if (now < closeDate) {
            throw createErrorResponse(
                `Fatura ${String(competencia_mes).padStart(2, "0")}/${competencia_ano} ainda não fechou. Fechamento em ${closeDate.toISOString().slice(0, 10)}.`,
                400
            )
        }

        const [totalResult] = await db
            .select({ total: sum(expenses.quantidade) })
            .from(expenses)
            .where(
                and(
                    eq(expenses.user_id, user_id),
                    eq(expenses.card_id, card_id),
                    eq(expenses.competencia_mes, competencia_mes),
                    eq(expenses.competencia_ano, competencia_ano)
                )
            )

        const total = Number(totalResult?.total || 0)

        if (total === 0) {
            throw createErrorResponse("Não há despesas nesta competência para pagar.", 400)
        }

        await db.transaction(async (tx) => {
            const [alreadyPaid] = await tx
                .select()
                .from(cardInvoicesPayments)
                .where(
                    and(
                        eq(cardInvoicesPayments.user_id, user_id),
                        eq(cardInvoicesPayments.card_id, card_id),
                        eq(cardInvoicesPayments.competencia_mes, competencia_mes!),
                        eq(cardInvoicesPayments.competencia_ano, competencia_ano!)
                    )
                )
                .limit(1)

            if (alreadyPaid) {
                throw createErrorResponse("Esta fatura já foi paga.", 400)
            }

            await tx
                .update(cards)
                .set({ limite_disponivel: sql`${cards.limite_disponivel} + ${total}` })
                .where(eq(cards.id, card_id))

            await tx.insert(cardInvoicesPayments).values({
                user_id,
                card_id,
                competencia_mes: competencia_mes!,
                competencia_ano: competencia_ano!,
                amount_paid: String(total),
            })
        })

        return {
            competencia_mes: competencia_mes!,
            competencia_ano: competencia_ano!,
            total_devolvido: total,
            fechamento_em: closeDate
        }
    }

    static async getAvailableInvoices(user_id: number, card_id: number): Promise<Array<{
        competencia_mes: number
        competencia_ano: number
        total_fatura: number
        data_vencimento: string
        data_fechamento: string
        pode_pagar: boolean
    }>> {
        const [card] = await db
            .select({
                dia_vencimento: cards.dia_vencimento,
                dias_fechamento_antes: cards.dias_fechamento_antes,
            })
            .from(cards)
            .where(and(eq(cards.id, card_id), eq(cards.user_id, user_id)))
            .limit(1)

        if (!card) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        const dueDay = Number(card.dia_vencimento)
        const closeBefore = Number(card.dias_fechamento_antes ?? 10)

        const expensesResult = await db.execute(sql`
            SELECT
                e.competencia_mes,
                e.competencia_ano,
                SUM(e.quantidade) as total_fatura
            FROM expenses e
            LEFT JOIN card_invoices_payments p
                ON p.user_id = e.user_id
                AND p.card_id = e.card_id
                AND p.competencia_mes = e.competencia_mes
                AND p.competencia_ano = e.competencia_ano
            WHERE e.user_id = ${user_id} AND e.card_id = ${card_id} AND p.id IS NULL
              AND e.competencia_mes IS NOT NULL
              AND e.competencia_ano IS NOT NULL
            GROUP BY e.competencia_mes, e.competencia_ano
            ORDER BY e.competencia_ano, e.competencia_mes
        `)

        const rows = expensesResult.rows as unknown as Array<{
            competencia_mes: number
            competencia_ano: number
            total_fatura: string
        }>

        const now = new Date()

        return rows.map((row) => {
            const mes = Number(row.competencia_mes)
            const ano = Number(row.competencia_ano)
            const dueDate = new Date(ano, mes - 1, Math.min(dueDay, 28))
            const closeDate = new Date(dueDate)
            closeDate.setDate(closeDate.getDate() - closeBefore)

            return {
                competencia_mes: mes,
                competencia_ano: ano,
                total_fatura: Number(row.total_fatura),
                data_vencimento: dueDate.toISOString().split('T')[0],
                data_fechamento: closeDate.toISOString().split('T')[0],
                pode_pagar: now >= closeDate
            }
        })
    }

    static async getPaymentHistory(
        user_id: number,
        card_id: number,
        limit: number = 10
    ): Promise<Array<{
        competencia_mes: number
        competencia_ano: number
        amount_paid: number
        paid_at: Date
    }>> {
        const payments = await db
            .select()
            .from(cardInvoicesPayments)
            .where(
                and(
                    eq(cardInvoicesPayments.user_id, user_id),
                    eq(cardInvoicesPayments.card_id, card_id)
                )
            )
            .orderBy(desc(cardInvoicesPayments.competencia_ano), desc(cardInvoicesPayments.competencia_mes))
            .limit(limit)

        return payments.map((p) => ({
            competencia_mes: p.competencia_mes,
            competencia_ano: p.competencia_ano,
            amount_paid: Number(p.amount_paid),
            paid_at: p.created_at
        }))
    }

    static async cancelInvoicePayment(
        user_id: number,
        card_id: number,
        competencia_mes: number,
        competencia_ano: number
    ): Promise<{ message: string; amount_reverted: number }> {
        const [payment] = await db
            .select()
            .from(cardInvoicesPayments)
            .where(
                and(
                    eq(cardInvoicesPayments.user_id, user_id),
                    eq(cardInvoicesPayments.card_id, card_id),
                    eq(cardInvoicesPayments.competencia_mes, competencia_mes),
                    eq(cardInvoicesPayments.competencia_ano, competencia_ano)
                )
            )
            .limit(1)

        if (!payment) {
            throw createErrorResponse("Pagamento não encontrado.", 404)
        }

        const amountPaid = Number(payment.amount_paid)

        await db.transaction(async (tx) => {
            const [card] = await tx
                .select({ limite_disponivel: cards.limite_disponivel, limite: cards.limite })
                .from(cards)
                .where(eq(cards.id, card_id))
                .limit(1)

            if (!card) throw createErrorResponse("Cartão não encontrado.", 404)

            const limiteDisponivel = Number(card.limite_disponivel)
            const limite = Number(card.limite)
            const novoLimite = limiteDisponivel - amountPaid

            if (novoLimite < 0) {
                throw createErrorResponse(
                    `Não é possível cancelar: o limite disponível ficaria negativo (R$ ${novoLimite.toFixed(2)}). Há despesas que reduziriam o limite abaixo de zero.`,
                    400
                )
            }

            if (novoLimite > limite) {
                throw createErrorResponse(
                    `Não é possível cancelar: o limite disponível ultrapassaria o limite do cartão.`,
                    400
                )
            }

            await tx
                .update(cards)
                .set({ limite_disponivel: sql`${cards.limite_disponivel} - ${amountPaid}` })
                .where(eq(cards.id, card_id))

            await tx.delete(cardInvoicesPayments).where(eq(cardInvoicesPayments.id, payment.id))
        })

        return {
            message: `Pagamento da fatura ${competencia_mes}/${competencia_ano} cancelado com sucesso.`,
            amount_reverted: amountPaid
        }
    }

    static async canPayInvoice(
        user_id: number,
        card_id: number,
        competencia_mes: number,
        competencia_ano: number
    ): Promise<{ can_pay: boolean; reason?: string; close_date?: string }> {
        const [card] = await db
            .select({
                dia_vencimento: cards.dia_vencimento,
                dias_fechamento_antes: cards.dias_fechamento_antes,
            })
            .from(cards)
            .where(and(eq(cards.id, card_id), eq(cards.user_id, user_id)))
            .limit(1)

        if (!card) {
            return { can_pay: false, reason: "Cartão não encontrado." }
        }

        const dueDay = Number(card.dia_vencimento)
        const closeBefore = Number(card.dias_fechamento_antes ?? 10)

        const [alreadyPaid] = await db
            .select()
            .from(cardInvoicesPayments)
            .where(
                and(
                    eq(cardInvoicesPayments.user_id, user_id),
                    eq(cardInvoicesPayments.card_id, card_id),
                    eq(cardInvoicesPayments.competencia_mes, competencia_mes),
                    eq(cardInvoicesPayments.competencia_ano, competencia_ano)
                )
            )
            .limit(1)

        if (alreadyPaid) {
            return { can_pay: false, reason: "Esta fatura já foi paga." }
        }

        const dueDate = new Date(competencia_ano, competencia_mes - 1, Math.min(dueDay, 28))
        const closeDate = new Date(dueDate)
        closeDate.setDate(closeDate.getDate() - closeBefore)

        if (new Date() < closeDate) {
            return {
                can_pay: false,
                reason: `Fatura ainda não fechou. Fechamento em ${closeDate.toISOString().slice(0, 10)}.`,
                close_date: closeDate.toISOString().split('T')[0]
            }
        }

        return { can_pay: true }
    }
}
