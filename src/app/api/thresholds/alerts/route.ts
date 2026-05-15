import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { ThresholdService } from '@/server/services/thresholdService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { searchParams } = new URL(request.url)
    const parsedMonth = searchParams.get('month') ? toNumber(searchParams.get('month')) : undefined
    const parsedYear = searchParams.get('year') ? toNumber(searchParams.get('year')) : undefined

    const targetMonth = typeof parsedMonth === 'number' && !isNaN(parsedMonth) ? parsedMonth : undefined
    const targetYear = typeof parsedYear === 'number' && !isNaN(parsedYear) ? parsedYear : undefined

    if (targetMonth && (targetMonth < 1 || targetMonth > 12)) {
      return err('Mês deve estar entre 1 e 12.', 400)
    }

    const alerts = await ThresholdService.getThresholdAlerts(user.id, targetMonth, targetYear)
    return ok(alerts, 'Alertas de limites recuperados com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar alertas de limites.')
  }
}
