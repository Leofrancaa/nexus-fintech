import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import { getComparativoMensal, getCartoesEstourados } from '@/server/utils/finance/index'
import prisma from '@/server/db/prisma'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    const [comparativo, cartoesEstourados, thresholds, thresholdViolations, planos, faturasPendentes] = await Promise.all([
      getComparativoMensal(user.id, mes, ano),
      getCartoesEstourados(user.id),
      prisma.threshold.findMany({ where: { user_id: user.id } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM thresholds t
        JOIN (
          SELECT category_id, SUM(quantidade) AS total
          FROM expenses
          WHERE user_id = ${user.id}
            AND EXTRACT(MONTH FROM data) = ${mes}
            AND EXTRACT(YEAR FROM data) = ${ano}
          GROUP BY category_id
        ) e ON e.category_id = t.category_id
        WHERE t.user_id = ${user.id}
          AND e.total > t.valor
      `,
      prisma.plan.findMany({ where: { user_id: user.id, status: { not: 'Concluído' } } }),
      prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count
        FROM expenses e
        LEFT JOIN card_invoices_payments p
            ON p.user_id = e.user_id AND p.card_id = e.card_id
            AND p.competencia_mes = e.competencia_mes AND p.competencia_ano = e.competencia_ano
        WHERE e.user_id = ${user.id}
          AND e.card_id IS NOT NULL
          AND e.competencia_mes IS NOT NULL
          AND e.competencia_ano IS NOT NULL
          AND (e.competencia_ano < ${ano} OR (e.competencia_ano = ${ano} AND e.competencia_mes < ${mes}))
          AND p.id IS NULL
      `
    ])

    const scores: Record<string, { pontos: number; descricao: string }> = {}

    const receitas = Number(comparativo.receitas.atual || 0)
    const despesas = Number(comparativo.despesas.atual || 0)
    scores.balanco = {
      pontos: receitas > despesas ? 20 : 0,
      descricao: receitas > despesas ? 'Receitas maiores que despesas este mês' : 'Despesas maiores que receitas este mês'
    }

    scores.limites = {
      pontos: cartoesEstourados.length === 0 ? 20 : 0,
      descricao: cartoesEstourados.length === 0
        ? 'Todos os cartões com limite saudável'
        : `${cartoesEstourados.length} cartão(ões) com limite crítico`
    }

    const violacoesCount = Number((thresholdViolations[0] as { count: bigint }).count)
    scores.thresholds = {
      pontos: thresholds.length === 0 ? 10 : violacoesCount === 0 ? 20 : 0,
      descricao: thresholds.length === 0
        ? 'Nenhum limite de gastos configurado'
        : violacoesCount === 0
          ? 'Todos os limites de gasto respeitados'
          : `${violacoesCount} limite(s) de gasto excedido(s)`
    }

    const planosComProgresso = planos.filter((p: { total_contribuido: unknown }) => Number(p.total_contribuido) > 0)
    scores.planos = {
      pontos: planosComProgresso.length > 0 ? 20 : (planos.length > 0 ? 10 : 0),
      descricao: planosComProgresso.length > 0
        ? `${planosComProgresso.length} plano(s) em andamento`
        : planos.length > 0 ? 'Planos criados mas sem contribuições' : 'Nenhum plano de poupança ativo'
    }

    const faturasPendentesCount = Number((faturasPendentes[0] as { count: bigint }).count)
    scores.faturas = {
      pontos: faturasPendentesCount === 0 ? 20 : 0,
      descricao: faturasPendentesCount === 0
        ? 'Nenhuma fatura em atraso'
        : `${faturasPendentesCount} fatura(s) de meses anteriores não pagas`
    }

    const total = Object.values(scores).reduce((sum, s) => sum + s.pontos, 0)
    const nivel = total >= 80 ? 'Excelente' : total >= 60 ? 'Bom' : total >= 40 ? 'Regular' : 'Atenção'

    return ok({ score: total, nivel, criterios: scores }, 'Score de saúde financeira calculado.')
  } catch (error) {
    return apiError(error, 'Erro ao calcular score de saúde financeira.')
  }
}
