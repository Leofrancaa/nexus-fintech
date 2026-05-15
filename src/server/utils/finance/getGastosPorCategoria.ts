// @ts-nocheck
import prisma from '@/server/db/prisma'

export interface GastosPorCategoriaResult {
    id: number
    nome: string
    total: number
}

interface RawRow {
    id: number
    nome: string
    total: string | number
}

export const getGastosPorCategoria = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<GastosPorCategoriaResult[]> => {
    const rows = await prisma.$queryRaw<RawRow[]>`
        SELECT c.id, c.nome, SUM(e.quantidade) as total
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE e.user_id = ${user_id}
        AND EXTRACT(MONTH FROM e.data) = ${mes}
        AND EXTRACT(YEAR FROM e.data) = ${ano}
        GROUP BY c.id, c.nome
        ORDER BY total DESC
    `

    return rows.map(row => ({ id: row.id, nome: row.nome, total: Number(row.total) }))
}
