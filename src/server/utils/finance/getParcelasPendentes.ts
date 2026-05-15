import prisma from '@/server/db/prisma'
import { formatDate } from '@/server/utils/helper'

export interface ParcelasPendentesResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: number
    data: string
    parcelas: number
}

export const getParcelasPendentes = async (user_id: number): Promise<ParcelasPendentesResult[]> => {
    const today = new Date(formatDate(new Date()))

    const expenses = await prisma.expense.findMany({
        where: {
            user_id,
            parcelas: { not: null },
            data: { gte: today },
        },
        orderBy: { data: 'asc' },
        select: {
            id: true,
            metodo_pagamento: true,
            tipo: true,
            quantidade: true,
            data: true,
            parcelas: true,
        },
    })

    return expenses.map((e: typeof expenses[number]) => ({
        id: e.id,
        metodo_pagamento: e.metodo_pagamento,
        tipo: e.tipo,
        quantidade: Number(e.quantidade),
        data: e.data instanceof Date ? e.data.toISOString().split('T')[0] : String(e.data),
        parcelas: e.parcelas!,
    }))
}
