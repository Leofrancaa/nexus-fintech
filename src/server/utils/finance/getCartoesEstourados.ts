import { sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'

export interface CartoesEstouradosResult {
    id: number
    nome: string
    limite: number
}

interface RawRow {
    id: number
    nome: string
    limite: string | number
}

export const getCartoesEstourados = async (user_id: number): Promise<CartoesEstouradosResult[]> => {
    const result = await db.execute(sql`
        SELECT c.id, c.nome, c.limite
        FROM cards c
        LEFT JOIN expenses e ON c.id = e.card_id AND e.user_id = ${user_id}
        WHERE c.user_id = ${user_id} AND c.limite::numeric <= 200
        GROUP BY c.id, c.nome, c.limite
    `)
    const rows = result.rows as unknown as RawRow[]

    return rows.map((row: RawRow) => ({
        id: row.id,
        nome: row.nome,
        limite: Number(row.limite),
    }))
}
