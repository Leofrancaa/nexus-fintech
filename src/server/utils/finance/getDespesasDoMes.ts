import { sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'

export interface DespesasDoMesResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: number
    fixo: boolean
    data: string
    parcelas?: number
    frequencia?: string
    user_id: number
    card_id?: number
    category_id?: number
    observacoes?: string
    created_at: Date
    updated_at: Date
}

interface RawRow {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: string | number
    fixo: boolean
    data: Date | string
    parcelas: number | null
    frequencia: string | null
    user_id: number
    card_id: number | null
    category_id: number | null
    observacoes: string | null
    created_at: Date
    updated_at: Date
}

export const getDespesasDoMes = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<DespesasDoMesResult[]> => {
    const result = await db.execute(sql`
        SELECT * FROM expenses
        WHERE user_id = ${user_id}
        AND EXTRACT(MONTH FROM data) = ${mes}
        AND EXTRACT(YEAR FROM data) = ${ano}
    `)
    const rows = result.rows as unknown as RawRow[]

    return rows.map((row: RawRow) => ({
        id: row.id,
        metodo_pagamento: row.metodo_pagamento,
        tipo: row.tipo,
        quantidade: Number(row.quantidade),
        fixo: row.fixo,
        data: row.data instanceof Date ? row.data.toISOString().split('T')[0] : String(row.data),
        parcelas: row.parcelas ?? undefined,
        frequencia: row.frequencia ?? undefined,
        user_id: row.user_id,
        card_id: row.card_id ?? undefined,
        category_id: row.category_id ?? undefined,
        observacoes: row.observacoes ?? undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}
