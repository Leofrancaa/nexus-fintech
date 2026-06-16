import { sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'

export interface ResumoAnualResult {
    mes: string
    total_receitas: number
    total_despesas: number
}

interface MesRow {
    mes: number
    total_receitas?: string | number
    total_despesas?: string | number
}

export const getResumoAnual = async (user_id: number, ano: number): Promise<ResumoAnualResult[]> => {
    const [receitasQuery, despesasQuery] = await Promise.all([
        db.execute(sql`
            SELECT EXTRACT(MONTH FROM data) AS mes, SUM(quantidade) AS total_receitas
            FROM incomes
            WHERE user_id = ${user_id} AND EXTRACT(YEAR FROM data) = ${ano}
            GROUP BY mes ORDER BY mes
        `),
        db.execute(sql`
            SELECT EXTRACT(MONTH FROM data) AS mes, SUM(quantidade) AS total_despesas
            FROM expenses
            WHERE user_id = ${user_id} AND EXTRACT(YEAR FROM data) = ${ano}
            GROUP BY mes ORDER BY mes
        `),
    ])

    const receitasMap = new Map<number, number>()
    const despesasMap = new Map<number, number>()

    ;(receitasQuery.rows as unknown as MesRow[]).forEach((r) =>
        receitasMap.set(Number(r.mes), Number(r.total_receitas ?? 0))
    )
    ;(despesasQuery.rows as unknown as MesRow[]).forEach((d) =>
        despesasMap.set(Number(d.mes), Number(d.total_despesas ?? 0))
    )

    return Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        return {
            mes: mes.toString(),
            total_receitas: receitasMap.get(mes) ?? 0,
            total_despesas: despesasMap.get(mes) ?? 0,
        }
    })
}
