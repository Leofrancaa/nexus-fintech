import prisma from '@/server/db/prisma'

export interface CartoesAVencerResult {
    id: number
    nome: string
    limite: number
    total_gasto: number
    dia_vencimento: number
}

interface RawRow {
    id: number
    nome: string
    limite: string | number
    total_gasto: string | number
    dia_vencimento: number
}

export const getCartoesAVencer = async (user_id: number): Promise<CartoesAVencerResult[]> => {
    const hoje = new Date()
    const diaHoje = hoje.getDate()

    const dias: number[] = []
    for (let i = 0; i <= 5; i++) {
        const dataTemp = new Date(hoje)
        dataTemp.setDate(diaHoje + i)
        dias.push(dataTemp.getDate())
    }

    const rows = await prisma.$queryRaw<RawRow[]>`
        SELECT
            id, nome, limite,
            (SELECT COALESCE(SUM(quantidade), 0)
             FROM expenses
             WHERE card_id = cards.id AND user_id = ${user_id}) AS total_gasto,
            dia_vencimento
        FROM cards
        WHERE user_id = ${user_id} AND dia_vencimento = ANY(${dias}::int[])
    `

    return rows.map((row: RawRow) => ({
        id: row.id,
        nome: row.nome,
        limite: Number(row.limite),
        total_gasto: Number(row.total_gasto),
        dia_vencimento: row.dia_vencimento,
    }))
}
