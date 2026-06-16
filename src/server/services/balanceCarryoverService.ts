import { and, eq, gte, lt, desc, sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { incomes, expenses, categories } from '@/server/db/schema'
import { createErrorResponse } from '@/server/utils/helper'

const CARRYOVER_INCOME_TYPE = 'saldo_anterior'
const CARRYOVER_EXPENSE_TYPE = 'debito_anterior'
const CARRYOVER_INCOME_CATEGORY = 'Saldo do Mês Anterior'
const CARRYOVER_EXPENSE_CATEGORY = 'Débito do Mês Anterior'

function prevMonth(mes: number, ano: number) {
    return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano }
}

function startOfMonth(mes: number, ano: number) {
    return new Date(ano, mes - 1, 1)
}

function startOfNextMonth(mes: number, ano: number) {
    return mes === 12 ? new Date(ano + 1, 0, 1) : new Date(ano, mes, 1)
}

export interface CarryoverStatus {
    source_mes: number
    source_ano: number
    saldo: number
    tipo: 'positivo' | 'negativo' | 'zerado'
    status: 'pendente' | 'aplicado' | 'sem_saldo'
    income_id?: number
    expense_id?: number
}

export class BalanceCarryoverService {
    static async check(userId: number, targetMes: number, targetAno: number): Promise<CarryoverStatus> {
        const { mes: srcMes, ano: srcAno } = prevMonth(targetMes, targetAno)

        const [receitasRaw, despesasRaw] = await Promise.all([
            db.execute(sql`
                SELECT COALESCE(SUM(quantidade), 0) AS total
                FROM incomes
                WHERE user_id = ${userId}
                  AND tipo != ${CARRYOVER_INCOME_TYPE}
                  AND EXTRACT(MONTH FROM data) = ${srcMes}
                  AND EXTRACT(YEAR FROM data) = ${srcAno}
            `),
            db.execute(sql`
                SELECT COALESCE(SUM(quantidade), 0) AS total
                FROM expenses
                WHERE user_id = ${userId}
                  AND tipo != ${CARRYOVER_EXPENSE_TYPE}
                  AND EXTRACT(MONTH FROM data) = ${srcMes}
                  AND EXTRACT(YEAR FROM data) = ${srcAno}
            `),
        ])

        const saldo =
            Number((receitasRaw.rows[0] as { total: string }).total) -
            Number((despesasRaw.rows[0] as { total: string }).total)

        if (saldo === 0) {
            return { source_mes: srcMes, source_ano: srcAno, saldo: 0, tipo: 'zerado', status: 'sem_saldo' }
        }

        const targetStart = startOfMonth(targetMes, targetAno)
        const targetEnd = startOfNextMonth(targetMes, targetAno)

        if (saldo > 0) {
            const [existing] = await db
                .select({ id: incomes.id })
                .from(incomes)
                .where(
                    and(
                        eq(incomes.user_id, userId),
                        eq(incomes.tipo, CARRYOVER_INCOME_TYPE),
                        gte(incomes.data, targetStart),
                        lt(incomes.data, targetEnd)
                    )
                )
                .limit(1)
            return {
                source_mes: srcMes, source_ano: srcAno,
                saldo, tipo: 'positivo',
                status: existing ? 'aplicado' : 'pendente',
                income_id: existing?.id,
            }
        } else {
            const [existing] = await db
                .select({ id: expenses.id })
                .from(expenses)
                .where(
                    and(
                        eq(expenses.user_id, userId),
                        eq(expenses.tipo, CARRYOVER_EXPENSE_TYPE),
                        gte(expenses.data, targetStart),
                        lt(expenses.data, targetEnd)
                    )
                )
                .limit(1)
            return {
                source_mes: srcMes, source_ano: srcAno,
                saldo, tipo: 'negativo',
                status: existing ? 'aplicado' : 'pendente',
                expense_id: existing?.id,
            }
        }
    }

    static async apply(userId: number, targetMes: number, targetAno: number): Promise<CarryoverStatus> {
        const info = await this.check(userId, targetMes, targetAno)

        if (info.status === 'aplicado') {
            throw createErrorResponse('Saldo já foi transferido para este mês.', 409)
        }
        if (info.tipo === 'zerado') {
            throw createErrorResponse('Não há saldo a transferir no mês anterior.', 400)
        }

        const targetDate = startOfMonth(targetMes, targetAno)

        if (info.tipo === 'positivo') {
            const category = await this.getOrCreateCategory(userId, CARRYOVER_INCOME_CATEGORY, 'receita', '#10B981')

            const [income] = await db
                .insert(incomes)
                .values({
                    user_id: userId,
                    tipo: CARRYOVER_INCOME_TYPE,
                    quantidade: String(info.saldo),
                    nota: `Saldo transferido de ${info.source_mes}/${info.source_ano}`,
                    fonte: CARRYOVER_INCOME_CATEGORY,
                    data: targetDate,
                    fixo: false,
                    category_id: category.id,
                })
                .returning({ id: incomes.id })
            return { ...info, status: 'aplicado', income_id: income.id }
        } else {
            const category = await this.getOrCreateCategory(userId, CARRYOVER_EXPENSE_CATEGORY, 'despesa', '#EF4444')

            const [expense] = await db
                .insert(expenses)
                .values({
                    user_id: userId,
                    tipo: CARRYOVER_EXPENSE_TYPE,
                    quantidade: String(Math.abs(info.saldo)),
                    metodo_pagamento: 'saldo',
                    observacoes: `Débito transferido de ${info.source_mes}/${info.source_ano}`,
                    data: targetDate,
                    fixo: false,
                    category_id: category.id,
                })
                .returning({ id: expenses.id })
            return { ...info, status: 'aplicado', expense_id: expense.id }
        }
    }

    static async undo(userId: number, targetMes: number, targetAno: number): Promise<void> {
        const info = await this.check(userId, targetMes, targetAno)

        if (info.status !== 'aplicado') {
            throw createErrorResponse('Nenhum carryover aplicado encontrado para este mês.', 404)
        }

        if (info.income_id) {
            await db.delete(incomes).where(eq(incomes.id, info.income_id))
        } else if (info.expense_id) {
            await db.delete(expenses).where(eq(expenses.id, info.expense_id))
        }
    }

    static async history(userId: number): Promise<Array<{
        mes: number
        ano: number
        saldo: number
        tipo: 'positivo' | 'negativo'
        applied_at: Date
    }>> {
        const [incomeRows, expenseRows] = await Promise.all([
            db
                .select({ quantidade: incomes.quantidade, data: incomes.data, created_at: incomes.created_at })
                .from(incomes)
                .where(and(eq(incomes.user_id, userId), eq(incomes.tipo, CARRYOVER_INCOME_TYPE)))
                .orderBy(desc(incomes.data)),
            db
                .select({ quantidade: expenses.quantidade, data: expenses.data, created_at: expenses.created_at })
                .from(expenses)
                .where(and(eq(expenses.user_id, userId), eq(expenses.tipo, CARRYOVER_EXPENSE_TYPE)))
                .orderBy(desc(expenses.data)),
        ])

        const result = [
            ...incomeRows.map((i) => ({
                mes: i.data.getMonth() + 1,
                ano: i.data.getFullYear(),
                saldo: Number(i.quantidade),
                tipo: 'positivo' as const,
                applied_at: i.created_at,
            })),
            ...expenseRows.map((e) => ({
                mes: e.data.getMonth() + 1,
                ano: e.data.getFullYear(),
                saldo: -Number(e.quantidade),
                tipo: 'negativo' as const,
                applied_at: e.created_at,
            })),
        ]

        return result.sort((a, b) => b.applied_at.getTime() - a.applied_at.getTime())
    }

    private static async getOrCreateCategory(
        userId: number,
        nome: string,
        tipo: 'receita' | 'despesa',
        cor: string
    ) {
        const [existing] = await db
            .select()
            .from(categories)
            .where(
                and(eq(categories.user_id, userId), eq(categories.nome, nome), eq(categories.tipo, tipo))
            )
            .limit(1)
        if (existing) return existing

        const [created] = await db
            .insert(categories)
            .values({ user_id: userId, nome, tipo, cor })
            .returning()
        return created
    }
}
