import prisma from '@/server/db/prisma'

interface TotalRow {
    total: string | number
}

interface ComparativoMensalResult {
    receitas: { atual: number; anterior: number }
    despesas: { atual: number; anterior: number }
}

export const getComparativoMensal = async (
    user_id: number,
    mesAtual: number,
    anoAtual: number
): Promise<ComparativoMensalResult> => {
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
    const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual

    const [receitaAtual, receitaAnterior, despesaAtual, despesaAnterior] = await Promise.all([
        prisma.$queryRaw<TotalRow[]>`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAtual} AND EXTRACT(YEAR FROM data) = ${anoAtual}
        `,
        prisma.$queryRaw<TotalRow[]>`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAnterior} AND EXTRACT(YEAR FROM data) = ${anoAnterior}
        `,
        prisma.$queryRaw<TotalRow[]>`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAtual} AND EXTRACT(YEAR FROM data) = ${anoAtual}
        `,
        prisma.$queryRaw<TotalRow[]>`
            SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses
            WHERE user_id = ${user_id} AND EXTRACT(MONTH FROM data) = ${mesAnterior} AND EXTRACT(YEAR FROM data) = ${anoAnterior}
        `,
    ])

    return {
        receitas: {
            atual: Number(receitaAtual[0]?.total ?? 0),
            anterior: Number(receitaAnterior[0]?.total ?? 0),
        },
        despesas: {
            atual: Number(despesaAtual[0]?.total ?? 0),
            anterior: Number(despesaAnterior[0]?.total ?? 0),
        },
    }
}
