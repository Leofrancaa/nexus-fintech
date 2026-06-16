import { sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'

export interface GastosPorCartaoResult {
    cartao: string
    total: number
}

interface RawRow {
    cartao: string
    total: string | number
}

export const getGastosPorCartao = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<GastosPorCartaoResult[]> => {
    const result = await db.execute(sql`
        SELECT c.nome AS cartao, SUM(e.quantidade) AS total
        FROM expenses e
        JOIN cards c ON e.card_id = c.id
        WHERE e.user_id = ${user_id}
        AND EXTRACT(MONTH FROM e.data) = ${mes}
        AND EXTRACT(YEAR FROM e.data) = ${ano}
        GROUP BY c.nome
        ORDER BY total DESC
    `)
    const rows = result.rows as unknown as RawRow[]

    return rows.map((row: RawRow) => ({ cartao: row.cartao, total: Number(row.total) }))
}
