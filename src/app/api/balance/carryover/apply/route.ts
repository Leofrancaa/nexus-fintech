import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err } from '@/server/lib/apiResponse'
import { BalanceCarryoverService } from '@/server/services/balanceCarryoverService'
import { toNumber, resolveUserMessage } from '@/server/utils/helper'

export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const body = await request.json()
    const now = new Date()
    const mes = toNumber(body.mes) ?? now.getMonth() + 1
    const ano = toNumber(body.ano) ?? now.getFullYear()

    if (mes < 1 || mes > 12) {
      return err('Mês deve estar entre 1 e 12.', 400)
    }

    const result = await BalanceCarryoverService.apply(user.id, mes, ano)
    const msg = result.tipo === 'positivo'
      ? `Saldo de R$ ${result.saldo.toFixed(2)} transferido como receita em ${mes}/${ano}.`
      : `Débito de R$ ${Math.abs(result.saldo).toFixed(2)} transferido como despesa em ${mes}/${ano}.`

    return ok(result, msg, 201)
  } catch (error) {
    const apiError2 = error as { statusCode?: number; status?: number }
    const status = apiError2?.statusCode || apiError2?.status || 500
    return err(resolveUserMessage(error, 'Erro ao aplicar saldo anterior.'), status)
  }
}
