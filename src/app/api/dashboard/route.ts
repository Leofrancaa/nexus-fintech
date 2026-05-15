import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, apiError } from '@/server/lib/apiResponse'
import {
    getSaldoAtual,
    getSaldoFuturo,
    getTotaisMensais,
    getComparativoMensal,
    getGastosPorCategoria,
    getGastosPorCartao,
    getTopCategoriasGasto,
    getCartoesEstourados,
    getCartoesAVencer,
    getParcelasPendentes,
    getResumoAnual,
} from '@/server/utils/finance/index'
import { DashboardData } from '@/server/types/index'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    const [
      saldo,
      saldoFuturo,
      totaisMensais,
      comparativo,
      porCategoria,
      porCartao,
      topCategorias,
      cartoesEstourados,
      cartoesAVencer,
      parcelasPendentes,
      resumoAnual
    ] = await Promise.all([
      getSaldoAtual(user.id),
      getSaldoFuturo(user.id),
      getTotaisMensais(user.id),
      getComparativoMensal(user.id, mes, ano),
      getGastosPorCategoria(user.id, mes, ano),
      getGastosPorCartao(user.id, mes, ano),
      getTopCategoriasGasto(user.id, mes, ano),
      getCartoesEstourados(user.id),
      getCartoesAVencer(user.id),
      getParcelasPendentes(user.id),
      getResumoAnual(user.id, ano)
    ])

    const dashboardData: DashboardData = {
      saldo,
      saldoFuturo,
      totaisMensais: totaisMensais.receitas.map((receita, index) => ({
        mes: receita.mes,
        receitas: receita.total,
        despesas: totaisMensais.despesas[index]?.total || 0
      })),
      resumoAnual,
      comparativo,
      gastosPorCategoria: porCategoria,
      topCategorias,
      gastosPorCartao: porCartao,
      parcelasPendentes,
      cartoesEstourados,
      cartoesAVencer
    }

    return ok(dashboardData, 'Dados do dashboard carregados com sucesso')
  } catch (error) {
    return apiError(error, 'Erro ao carregar dados do dashboard.')
  }
}
