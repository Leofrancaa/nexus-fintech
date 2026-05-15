import prisma from '@/server/db/prisma'

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
        prisma.$queryRaw<MensalRow[]>`
            SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
            FROM incomes
            WHERE user_id = ${user_id}
            GROUP BY mes ORDER BY mes
        `,
        prisma.$queryRaw<MensalRow[]>`
            SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
            FROM expenses
            WHERE user_id = ${user_id}
            GROUP BY mes ORDER BY mes
        `,
    ])

    return {
        receitas: receitas.map((r: MensalRow) => ({ mes: Number(r.mes), total: Number(r.total) })),
        despesas: despesas.map((d: MensalRow) => ({ mes: Number(d.mes), total: Number(d.total) })),
    }
}
