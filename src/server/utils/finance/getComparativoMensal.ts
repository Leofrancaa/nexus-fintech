import { sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'

interface TotalRow {
    total: string | number
}

interface ComparativoMensalResult {
    receitas: { atual: number; anterior: number }
    despesas: { atual: number; anterior: number }
}

export const getComparativoMensal = async (
    user_id: number,
    mesAtual: number,
    anoAtual: number
): Promise<ComparativoMensalResult> => {
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
    const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual

    const [receitaAtual, receitaAnterior, despesaAtual, despesaAnterior] = await Promise.all([
        db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAtual} AND EXTRACT(YEAR FROM data) = ${anoAtual}
        `),
        db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAnterior} AND EXTRACT(YEAR FROM data) = ${anoAnterior}
        `),
        db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAtual} AND EXTRACT(YEAR FROM data) = ${anoAtual}
        `),
        db.execute(sql`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAnterior} AND EXTRACT(YEAR FROM data) = ${anoAnterior}
        `),
    ])

    const total = (r: { rows: unknown[] }): number =>
        Number((r.rows[0] as TotalRow | undefined)?.total ?? 0)

    return {
        receitas: {
            atual: total(receitaAtual),
            anterior: total(receitaAnterior),
        },
        despesas: {
            atual: total(despesaAtual),
            anterior: total(despesaAnterior),
        },
    }
}
