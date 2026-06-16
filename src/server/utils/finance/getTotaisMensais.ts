import { sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'

interface MensalRow {
    mes: number
    total: string | number
}

interface TotaisMensaisResult {
    receitas: Array<{ mes: number; total: number }>
    despesas: Array<{ mes: number; total: number }>
}

export const getTotaisMensais = async (user_id: number): Promise<TotaisMensaisResult> => {
    const [receitas, despesas] = await Promise.all([
        db.execute(sql`
            SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
            FROM incomes
            WHERE user_id = ${user_id}
            GROUP BY mes ORDER BY mes
        `),
        db.execute(sql`
            SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
            FROM expenses
            WHERE user_id = ${user_id}
            GROUP BY mes ORDER BY mes
        `),
    ])

    return {
        receitas: (receitas.rows as unknown as MensalRow[]).map((r) => ({
            mes: Number(r.mes),
            total: Number(r.total),
        })),
        despesas: (despesas.rows as unknown as MensalRow[]).map((d) => ({
            mes: Number(d.mes),
            total: Number(d.total),
        })),
    }
}
