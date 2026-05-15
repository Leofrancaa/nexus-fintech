import prisma from '@/server/db/prisma'

export const getSaldoAtual = async (user_id: number): Promise<number> => {
    const [receitas, despesas] = await Promise.all([
        prisma.income.aggregate({ where: { user_id }, _sum: { quantidade: true } }),
        prisma.expense.aggregate({ where: { user_id }, _sum: { quantidade: true } }),
    ])

    return Number(receitas._sum.quantidade ?? 0) - Number(despesas._sum.quantidade ?? 0)
}
