import { NextRequest } from 'next/server'
import { getAuthUser, unauthorizedResponse } from '@/server/lib/auth'
import { ok, err, apiError } from '@/server/lib/apiResponse'
import { PlanService } from '@/server/services/planService'
import { toNumber } from '@/server/utils/helper'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const planId = toNumber(id)
    if (!planId) return err('ID do plano inválido.', 400)
    const plan = await PlanService.getPlanById(planId, user.id)
    if (!plan) return err('Plano não encontrado.', 404)
    return ok(plan, 'Plano recuperado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao buscar plano.')
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const planId = toNumber(id)
    if (!planId) return err('ID do plano inválido.', 400)
    const updateData = await request.json()
    const updatedPlan = await PlanService.updatePlan(planId, updateData, user.id)
    return ok(updatedPlan, 'Plano atualizado com sucesso.')
  } catch (error) {
    return apiError(error, 'Erro ao atualizar plano.')
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getAuthUser(request)
    if (!user) return unauthorizedResponse()
    const { id } = await params
    const planId = toNumber(id)
    if (!planId) return err('ID do plano inválido.', 400)
    const result = await PlanService.deletePlan(planId, user.id)
    return ok(result, result.message)
  } catch (error) {
    return apiError(error, 'Erro ao deletar plano.')
  }
}
