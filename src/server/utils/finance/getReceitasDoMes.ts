import prisma from '@/server/db/prisma'

export interface ReceitasDoMesResult {
    id: number
    tipo: string
    quantidade: number
    nota?: string
    data: string
    fonte?: string
    user_id: number
    category_id?: number
    created_at: Date
    updated_at: Date
}

interface RawRow {
    id: number
    tipo: string
    quantidade: string | number
    nota: string | null
    data: Date | string
    fonte: string | null
    user_id: number
    category_id: number | null
    created_at: Date
    updated_at: Date
}

export const getReceitasDoMes = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<ReceitasDoMesResult[]> => {
    const rows = await prisma.$queryRaw<RawRow[]>`
        SELECT * FROM incomes
        WHERE user_id = ${user_id}
        AND EXTRACT(MONTH FROM data) = ${mes}
        AND EXTRACT(YEAR FROM data) = ${ano}
    `

    return rows.map((row: RawRow) => ({
        id: row.id,
        tipo: row.tipo,
        quantidade: Number(row.quantidade),
        nota: row.nota ?? undefined,
        data: row.data instanceof Date ? row.data.toISOString().split('T')[0] : String(row.data),
        fonte: row.fonte ?? undefined,
        user_id: row.user_id,
        category_id: row.category_id ?? undefined,
        created_at: row.created_at,
        updated_at: row.updated_at,
    }))
}
