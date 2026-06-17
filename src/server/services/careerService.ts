import { and, eq, asc, sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { careerProfile, careerMilestones } from '@/server/db/schema'
import {
  CareerProfile,
  CareerMilestone,
  UpdateCareerProfileRequest,
  CreateCareerMilestoneRequest,
  MilestoneStatus,
  CareerHorizon,
} from '@/server/types/index'
import { createErrorResponse, sanitizeString } from '@/server/utils/helper'

const VALID_STATUS: MilestoneStatus[] = ['planned', 'in_progress', 'done']
const VALID_HORIZON: CareerHorizon[] = ['0-6m', '6-18m', '18-36m']

function assertStatus(status: string): void {
  if (!VALID_STATUS.includes(status as MilestoneStatus)) {
    throw createErrorResponse('Status inválido.', 400)
  }
}

export class CareerService {
  // Garante um perfil de carreira VAZIO no primeiro acesso (sem plano padrão).
  // Cada usuário define o próprio norte, princípios e marcos.
  static async ensureProfile(userId: number): Promise<void> {
    const [existing] = await db
      .select({ user_id: careerProfile.user_id })
      .from(careerProfile)
      .where(eq(careerProfile.user_id, userId))
      .limit(1)

    if (existing) return

    await db.insert(careerProfile).values({ user_id: userId })
  }

  static async getProfile(userId: number): Promise<CareerProfile | null> {
    const [row] = await db
      .select()
      .from(careerProfile)
      .where(eq(careerProfile.user_id, userId))
      .limit(1)
    return (row as CareerProfile) ?? null
  }

  static async updateProfile(
    userId: number,
    data: UpdateCareerProfileRequest
  ): Promise<CareerProfile> {
    if (data.track && data.track !== 'technical' && data.track !== 'product') {
      throw createErrorResponse("Trilha deve ser 'technical' ou 'product'.", 400)
    }

    const values = {
      north_star: data.north_star !== undefined ? data.north_star : null,
      track: data.track !== undefined ? data.track : null,
      rationale: data.rationale !== undefined ? data.rationale : null,
      principles: data.principles ?? [],
    }

    const [row] = await db
      .insert(careerProfile)
      .values({ user_id: userId, ...values })
      .onConflictDoUpdate({
        target: careerProfile.user_id,
        set: { ...values, updated_at: new Date() },
      })
      .returning()

    return row as CareerProfile
  }

  static async getMilestones(userId: number): Promise<CareerMilestone[]> {
    const rows = await db
      .select()
      .from(careerMilestones)
      .where(eq(careerMilestones.user_id, userId))
      .orderBy(asc(careerMilestones.horizon), asc(careerMilestones.position), asc(careerMilestones.id))

    return rows as CareerMilestone[]
  }

  static async createMilestone(
    userId: number,
    data: CreateCareerMilestoneRequest
  ): Promise<CareerMilestone> {
    if (!data.title || !data.title.trim()) {
      throw createErrorResponse('Título é obrigatório.', 400)
    }
    if (!VALID_HORIZON.includes(data.horizon)) {
      throw createErrorResponse('Horizonte inválido.', 400)
    }
    if (data.status) assertStatus(data.status)

    const [row] = await db
      .insert(careerMilestones)
      .values({
        user_id: userId,
        title: sanitizeString(data.title.trim()),
        description: data.description ? sanitizeString(data.description) : null,
        horizon: data.horizon,
        status: data.status ?? 'planned',
        resource_url: data.resource_url ?? null,
        position: data.position ?? 0,
      })
      .returning()

    return row as CareerMilestone
  }

  static async updateMilestone(
    id: number,
    userId: number,
    data: Partial<CreateCareerMilestoneRequest>
  ): Promise<CareerMilestone> {
    const [existing] = await db
      .select()
      .from(careerMilestones)
      .where(and(eq(careerMilestones.id, id), eq(careerMilestones.user_id, userId)))
      .limit(1)

    if (!existing) throw createErrorResponse('Marco não encontrado.', 404)

    if (data.status !== undefined) assertStatus(data.status)
    if (data.horizon !== undefined && !VALID_HORIZON.includes(data.horizon)) {
      throw createErrorResponse('Horizonte inválido.', 400)
    }

    const setData = {
      ...(data.title !== undefined ? { title: sanitizeString(data.title.trim()) } : {}),
      ...(data.description !== undefined
        ? { description: data.description ? sanitizeString(data.description) : null }
        : {}),
      ...(data.horizon !== undefined ? { horizon: data.horizon } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.resource_url !== undefined ? { resource_url: data.resource_url } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
    }

    if (Object.keys(setData).length === 0) return existing as CareerMilestone

    const [row] = await db
      .update(careerMilestones)
      .set(setData)
      .where(eq(careerMilestones.id, id))
      .returning()

    return row as CareerMilestone
  }

  static async deleteMilestone(id: number, userId: number): Promise<{ message: string }> {
    const result = await db
      .delete(careerMilestones)
      .where(and(eq(careerMilestones.id, id), eq(careerMilestones.user_id, userId)))
      .returning({ id: careerMilestones.id })

    if (result.length === 0) throw createErrorResponse('Marco não encontrado.', 404)

    return { message: 'Marco removido com sucesso.' }
  }

  // Resumo de progresso (% de marcos concluídos).
  static async getProgress(userId: number): Promise<number> {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        done: sql<number>`count(*) filter (where ${careerMilestones.status} = 'done')`,
      })
      .from(careerMilestones)
      .where(eq(careerMilestones.user_id, userId))

    const total = Number(row?.total ?? 0)
    const done = Number(row?.done ?? 0)
    return total > 0 ? Math.round((done / total) * 100) : 0
  }
}
