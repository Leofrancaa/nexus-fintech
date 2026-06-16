import { and, eq, isNotNull, gte, asc } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { expenses } from '@/server/db/schema'
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

    const rows = await db
        .select({
            id: expenses.id,
            metodo_pagamento: expenses.metodo_pagamento,
            tipo: expenses.tipo,
            quantidade: expenses.quantidade,
            data: expenses.data,
            parcelas: expenses.parcelas,
        })
        .from(expenses)
        .where(
            and(
                eq(expenses.user_id, user_id),
                isNotNull(expenses.parcelas),
                gte(expenses.data, today)
            )
        )
        .orderBy(asc(expenses.data))

    return rows.map((e) => ({
        id: e.id,
        metodo_pagamento: e.metodo_pagamento,
        tipo: e.tipo,
        quantidade: Number(e.quantidade),
        data: e.data instanceof Date ? e.data.toISOString().split('T')[0] : String(e.data),
        parcelas: e.parcelas!,
    }))
}
