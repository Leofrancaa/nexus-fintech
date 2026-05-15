// @ts-nocheck
import prisma from '@/server/db/prisma'
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
            prisma.$queryRaw<[{ total: string }]>`
                SELECT COALESCE(SUM(quantidade), 0) AS total
                FROM incomes
                WHERE user_id = ${userId}
                  AND tipo != ${CARRYOVER_INCOME_TYPE}
                  AND EXTRACT(MONTH FROM data) = ${srcMes}
                  AND EXTRACT(YEAR FROM data) = ${srcAno}
            `,
            prisma.$queryRaw<[{ total: string }]>`
                SELECT COALESCE(SUM(quantidade), 0) AS total
                FROM expenses
                WHERE user_id = ${userId}
                  AND tipo != ${CARRYOVER_EXPENSE_TYPE}
                  AND EXTRACT(MONTH FROM data) = ${srcMes}
                  AND EXTRACT(YEAR FROM data) = ${srcAno}
            `,
        ])

        const saldo = Number(receitasRaw[0].total) - Number(despesasRaw[0].total)

        if (saldo === 0) {
            return { source_mes: srcMes, source_ano: srcAno, saldo: 0, tipo: 'zerado', status: 'sem_saldo' }
        }

        const targetStart = startOfMonth(targetMes, targetAno)
        const targetEnd = startOfNextMonth(targetMes, targetAno)

        if (saldo > 0) {
            const existing = await prisma.income.findFirst({
                where: { user_id: userId, tipo: CARRYOVER_INCOME_TYPE, data: { gte: targetStart, lt: targetEnd } },
                select: { id: true },
            })
            return {
                source_mes: srcMes, source_ano: srcAno,
                saldo, tipo: 'positivo',
                status: existing ? 'aplicado' : 'pendente',
                income_id: existing?.id,
            }
        } else {
            const existing = await prisma.expense.findFirst({
                where: { user_id: userId, tipo: CARRYOVER_EXPENSE_TYPE, data: { gte: targetStart, lt: targetEnd } },
                select: { id: true },
            })
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

            const income = await prisma.income.create({
                data: {
                    user_id: userId,
                    tipo: CARRYOVER_INCOME_TYPE,
                    quantidade: info.saldo,
                    nota: `Saldo transferido de ${info.source_mes}/${info.source_ano}`,
                    fonte: CARRYOVER_INCOME_CATEGORY,
                    data: targetDate,
                    fixo: false,
                    category_id: category.id,
                },
                select: { id: true },
            })
            return { ...info, status: 'aplicado', income_id: income.id }
        } else {
            const category = await this.getOrCreateCategory(userId, CARRYOVER_EXPENSE_CATEGORY, 'despesa', '#EF4444')

            const expense = await prisma.expense.create({
                data: {
                    user_id: userId,
                    tipo: CARRYOVER_EXPENSE_TYPE,
                    quantidade: Math.abs(info.saldo),
                    metodo_pagamento: 'saldo',
                    observacoes: `Débito transferido de ${info.source_mes}/${info.source_ano}`,
                    data: targetDate,
                    fixo: false,
                    category_id: category.id,
                },
                select: { id: true },
            })
            return { ...info, status: 'aplicado', expense_id: expense.id }
        }
    }

    static async undo(userId: number, targetMes: number, targetAno: number): Promise<void> {
        const info = await this.check(userId, targetMes, targetAno)

        if (info.status !== 'aplicado') {
            throw createErrorResponse('Nenhum carryover aplicado encontrado para este mês.', 404)
        }

        if (info.income_id) {
            await prisma.income.delete({ where: { id: info.income_id } })
        } else if (info.expense_id) {
            await prisma.expense.delete({ where: { id: info.expense_id } })
        }
    }

    static async history(userId: number): Promise<Array<{
        mes: number
        ano: number
        saldo: number
        tipo: 'positivo' | 'negativo'
        applied_at: Date
    }>> {
        const [incomes, expenses] = await Promise.all([
            prisma.income.findMany({
                where: { user_id: userId, tipo: CARRYOVER_INCOME_TYPE },
                select: { quantidade: true, data: true, created_at: true },
                orderBy: { data: 'desc' },
            }),
            prisma.expense.findMany({
                where: { user_id: userId, tipo: CARRYOVER_EXPENSE_TYPE },
                select: { quantidade: true, data: true, created_at: true },
                orderBy: { data: 'desc' },
            }),
        ])

        const result = [
            ...incomes.map(i => ({
                mes: i.data.getMonth() + 1,
                ano: i.data.getFullYear(),
                saldo: Number(i.quantidade),
                tipo: 'positivo' as const,
                applied_at: i.created_at,
            })),
            ...expenses.map(e => ({
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
        const existing = await prisma.category.findFirst({
            where: { user_id: userId, nome, tipo },
        })
        if (existing) return existing

        return prisma.category.create({
            data: { user_id: userId, nome, tipo, cor },
        })
    }
}
