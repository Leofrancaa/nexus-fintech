// @ts-nocheck
import prisma from '@/server/db/prisma'

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
    const rows = await prisma.$queryRaw<RawRow[]>`
        SELECT c.id, c.nome, c.limite
        FROM cards c
        LEFT JOIN expenses e ON c.id = e.card_id AND e.user_id = ${user_id}
        WHERE c.user_id = ${user_id} AND c.limite::numeric <= 200
        GROUP BY c.id, c.nome, c.limite
    `

    return rows.map(row => ({
        id: row.id,
        nome: row.nome,
        limite: Number(row.limite),
    }))
}
