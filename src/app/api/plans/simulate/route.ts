import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { PlanService } from '@/server/services/planService'

/**
 * Simula o aporte mensal necessário para um plano antes de salvá-lo.
 * Body: { meta: number, prazo: string (YYYY-MM-DD), taxa_anual?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()

    const { meta, prazo, taxa_anual } = await request.json()
    if (meta === undefined || !prazo) {
      return err('Meta e prazo são obrigatórios.', 400)
    }

    const result = await PlanService.simulateAporte({ meta, prazo, taxa_anual })
    return ok(result, 'Simulação realizada com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao simular o aporte mensal.')
  }
}
