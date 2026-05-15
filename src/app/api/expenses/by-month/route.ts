// @ts-nocheck
import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import prisma from '@/server/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const rows = await prisma.$queryRaw<Array<{ numero_mes: number; total: string }>>`
      SELECT
        EXTRACT(MONTH FROM data) AS numero_mes,
        SUM(quantidade) AS total
      FROM expenses
      WHERE user_id = ${user.id}
      GROUP BY numero_mes
      ORDER BY numero_mes
    `

    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    const dados = meses.map((mes, index) => {
      const encontrado = rows.find(r => Number(r.numero_mes) === index + 1)
      return { mes, total: encontrado ? Number(encontrado.total) : 0 }
    })

    return ok(dados, 'Despesas por mês recuperadas com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar despesas por mês.')
  }
}
