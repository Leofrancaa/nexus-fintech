import { Prisma } from '@prisma/client'
import prisma from '@/server/db/prisma'
import {
    Card,
    CreateCardRequest,
} from '@/server/types/index'
import {
    createErrorResponse,
    isPositiveNumber
} from '@/server/utils/helper'

interface CardWithStats extends Card {
    gasto_total: number
    proximo_vencimento: string
}

export class CardService {
    static async createCard(
        cardData: CreateCardRequest,
        userId: number
    ): Promise<Card> {
        const {
            nome,
            tipo,
            numero,
            cor,
            limite = 0,
            dia_vencimento,
            dias_fechamento_antes = 10
        } = cardData

        if (!numero || numero.length !== 4) {
            throw createErrorResponse("O número do cartão deve conter exatamente 4 dígitos.", 400)
        }

        const isCredito = tipo === 'crédito' || tipo === 'credito'
        const isDebito = tipo === 'débito' || tipo === 'debito'

        if (isCredito) {
            if (!dia_vencimento || dia_vencimento < 1 || dia_vencimento > 31) {
                throw createErrorResponse("O dia de vencimento deve estar entre 1 e 31 para cartões de crédito.", 400)
            }

            if (dias_fechamento_antes != null && (dias_fechamento_antes < 1 || dias_fechamento_antes > 31)) {
                throw createErrorResponse("Dias de fechamento antes deve estar entre 1 e 31.", 400)
            }

            if (!isPositiveNumber(limite)) {
                throw createErrorResponse("Limite deve ser um número positivo para cartões de crédito.", 400)
            }
        }

        const diaVencimentoFinal = isDebito ? 1 : dia_vencimento
        const diasFechamentoAntesFinal = isDebito ? 1 : dias_fechamento_antes

        const result = await prisma.card.create({
            data: {
                nome,
                tipo,
                numero,
                cor: cor || '#6B7280',
                limite,
                limite_disponivel: limite,
                dia_vencimento: diaVencimentoFinal!,
                dias_fechamento_antes: diasFechamentoAntesFinal!,
                user_id: userId,
            }
        })

        return this.mapToCard(result)
    }

    static async getCardsByUser(userId: number): Promise<CardWithStats[]> {
        const currentMonth = new Date().getMonth() + 1
        const currentYear = new Date().getFullYear()

        const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT
                c.*,
                COALESCE(SUM(e.quantidade), 0) AS gasto_total,
                CASE
                    WHEN CURRENT_DATE <= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, c.dia_vencimento)
                    THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, c.dia_vencimento)
                    ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int + 1, c.dia_vencimento)
                END AS proximo_vencimento
            FROM cards c
            LEFT JOIN expenses e ON e.card_id = c.id
                AND e.user_id = ${userId}
                AND (e.competencia_mes = ${currentMonth} AND e.competencia_ano = ${currentYear})
            WHERE c.user_id = ${userId}
            GROUP BY c.id
            ORDER BY c.id DESC
        `

        return result.map((card: Record<string, unknown>) => {
            const limite = Number(card.limite)
            const gastoTotal = Number(card.gasto_total)
            const limiteDisponivel = Number(card.limite_disponivel)

            return {
                ...card,
                limite,
                limite_disponivel: limiteDisponivel,
                gasto_total: gastoTotal,
            }
        }) as CardWithStats[]
    }

    static async getCardById(cardId: number, userId: number): Promise<Card | null> {
        const card = await prisma.card.findFirst({
            where: { id: cardId, user_id: userId }
        })

        return card ? this.mapToCard(card) : null
    }

    static async updateCard(
        cardId: number,
        updateData: Partial<CreateCardRequest>,
        userId: number
    ): Promise<Card> {
        const { nome, tipo, numero, cor, limite, dia_vencimento, dias_fechamento_antes } = updateData

        if (numero && numero.length !== 4) {
            throw createErrorResponse("O número do cartão deve conter exatamente 4 dígitos.", 400)
        }

        if (dia_vencimento && (dia_vencimento < 1 || dia_vencimento > 31)) {
            throw createErrorResponse("O dia de vencimento deve estar entre 1 e 31.", 400)
        }

        if (dias_fechamento_antes != null && (dias_fechamento_antes < 1 || dias_fechamento_antes > 31)) {
            throw createErrorResponse("Dias de fechamento antes deve estar entre 1 e 31.", 400)
        }

        if (limite !== undefined) {
            if (!isPositiveNumber(limite)) {
                throw createErrorResponse("Limite deve ser um número positivo.", 400)
            }

            const saldoEmAberto = await this.getSaldoEmAberto(cardId, userId)
            if (Number(limite) < Number(saldoEmAberto)) {
                throw createErrorResponse(
                    `O novo limite não pode ser menor que o saldo em aberto (faturas não pagas): R$ ${saldoEmAberto.toFixed(2)}`,
                    400
                )
            }

            const novoLimiteDisponivel = Math.max(Number(limite) - Number(saldoEmAberto), 0)

            const result = await prisma.card.update({
                where: { id: cardId },
                data: {
                    ...(nome !== undefined ? { nome } : {}),
                    ...(tipo !== undefined ? { tipo } : {}),
                    ...(numero !== undefined ? { numero } : {}),
                    ...(cor !== undefined ? { cor } : {}),
                    limite,
                    limite_disponivel: novoLimiteDisponivel,
                    ...(dia_vencimento !== undefined ? { dia_vencimento } : {}),
                    ...(dias_fechamento_antes !== undefined ? { dias_fechamento_antes } : {}),
                }
            })

            return this.mapToCard(result)
        }

        const exists = await prisma.card.findFirst({ where: { id: cardId, user_id: userId } })
        if (!exists) throw createErrorResponse("Cartão não encontrado.", 404)

        const result = await prisma.card.update({
            where: { id: cardId },
            data: {
                ...(nome !== undefined ? { nome } : {}),
                ...(tipo !== undefined ? { tipo } : {}),
                ...(numero !== undefined ? { numero } : {}),
                ...(cor !== undefined ? { cor } : {}),
                ...(dia_vencimento !== undefined ? { dia_vencimento } : {}),
                ...(dias_fechamento_antes !== undefined ? { dias_fechamento_antes } : {}),
            }
        })

        return this.mapToCard(result)
    }

    static async deleteCard(cardId: number, userId: number): Promise<{ message: string }> {
        const hasCurrentExpenses = await this.hasCurrentMonthExpenses(cardId, userId)
        if (hasCurrentExpenses) {
            throw createErrorResponse(
                "Este cartão possui despesas vinculadas no mês atual e não pode ser excluído.",
                400
            )
        }

        const hasPastExpenses = await this.hasPastExpenses(cardId, userId)
        if (hasPastExpenses) {
            await this.deleteCardAndExpenses(cardId, userId)
            return { message: "Cartão e todas as despesas anteriores vinculadas a ele foram excluídos com sucesso." }
        }

        const exists = await prisma.card.findFirst({ where: { id: cardId, user_id: userId } })
        if (!exists) throw createErrorResponse("Cartão não encontrado.", 404)

        await prisma.card.delete({ where: { id: cardId } })

        return { message: "Cartão removido com sucesso." }
    }

    static async getSaldoEmAberto(cardId: number, userId: number): Promise<number> {
        const result = await prisma.$queryRaw<Array<{ aberto: string }>>`
            SELECT COALESCE(SUM(e.quantidade), 0) AS aberto
            FROM expenses e
            LEFT JOIN card_invoices_payments p
                ON p.user_id = e.user_id
                AND p.card_id = e.card_id
                AND p.competencia_mes = e.competencia_mes
                AND p.competencia_ano = e.competencia_ano
            WHERE e.user_id = ${userId}
              AND e.card_id = ${cardId}
              AND p.id IS NULL
        `

        return Number(result[0].aberto)
    }

    static async hasCurrentMonthExpenses(cardId: number, userId: number): Promise<boolean> {
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM expenses
            WHERE card_id = ${cardId} AND user_id = ${userId}
              AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
              AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)
        `

        return Number(result[0].count) > 0
    }

    static async hasPastExpenses(cardId: number, userId: number): Promise<boolean> {
        const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
            SELECT COUNT(*) as count FROM expenses
            WHERE card_id = ${cardId} AND user_id = ${userId}
              AND (EXTRACT(MONTH FROM data) != EXTRACT(MONTH FROM CURRENT_DATE)
                OR EXTRACT(YEAR FROM data) != EXTRACT(YEAR FROM CURRENT_DATE))
        `

        return Number(result[0].count) > 0
    }

    static async deleteCardAndExpenses(cardId: number, userId: number): Promise<void> {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const exists = await tx.card.findFirst({ where: { id: cardId, user_id: userId } })
            if (!exists) throw createErrorResponse("Cartão não encontrado.", 404)

            await tx.expense.deleteMany({ where: { card_id: cardId, user_id: userId } })
            await tx.cardInvoicePayment.deleteMany({ where: { card_id: cardId, user_id: userId } })
            await tx.card.delete({ where: { id: cardId } })
        })
    }

    static async getFutureInstallments(cardId: number, userId: number): Promise<Array<{
        id: number
        tipo: string
        quantidade: number
        competencia_mes: number
        competencia_ano: number
        parcelas: number
        observacoes: string | null
    }>> {
        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()

        const card = await prisma.card.findFirst({
            where: { id: cardId, user_id: userId }
        })

        if (!card) throw createErrorResponse("Cartão não encontrado.", 404)

        const result = await prisma.$queryRaw<Array<{
            id: number
            tipo: string
            quantidade: string
            competencia_mes: number
            competencia_ano: number
            parcelas: number
            observacoes: string | null
        }>>`
            SELECT id, tipo, quantidade, competencia_mes, competencia_ano, parcelas, observacoes
            FROM expenses
            WHERE card_id = ${cardId}
              AND user_id = ${userId}
              AND parcelas IS NOT NULL
              AND fixo = false
              AND (
                  (competencia_ano > ${currentYear})
                  OR (competencia_ano = ${currentYear} AND competencia_mes >= ${currentMonth})
              )
            ORDER BY competencia_ano ASC, competencia_mes ASC
        `

        return result.map((r: { id: number; tipo: string; quantidade: string; competencia_mes: number; competencia_ano: number; parcelas: number; observacoes: string | null }) => ({
            ...r,
            quantidade: Number(r.quantidade),
        }))
    }

    private static mapToCard(card: Record<string, unknown>): Card {
        return {
            ...card,
            limite: Number(card.limite),
            limite_disponivel: Number(card.limite_disponivel),
        } as Card
    }
}
