import { and, eq, asc } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { personalGoals } from '@/server/db/schema'
import {
  PersonalGoal,
  CreatePersonalGoalRequest,
  MilestoneStatus,
} from '@/server/types/index'
import { createErrorResponse, sanitizeString, isValidDateString } from '@/server/utils/helper'

const VALID_STATUS: MilestoneStatus[] = ['planned', 'in_progress', 'done']

function mapGoal(row: typeof personalGoals.$inferSelect): PersonalGoal {
  return {
    ...row,
    target_date:
      row.target_date instanceof Date
        ? row.target_date.toISOString().split('T')[0]
        : (row.target_date as string | null),
  } as PersonalGoal
}

export class PersonalService {
  static async getGoals(userId: number): Promise<PersonalGoal[]> {
    const rows = await db
      .select()
      .from(personalGoals)
      .where(eq(personalGoals.user_id, userId))
      .orderBy(asc(personalGoals.position), asc(personalGoals.id))

    return rows.map(mapGoal)
  }

  static async createGoal(userId: number, data: CreatePersonalGoalRequest): Promise<PersonalGoal> {
    if (!data.title || !data.title.trim()) {
      throw createErrorResponse('Título é obrigatório.', 400)
    }
    if (data.status && !VALID_STATUS.includes(data.status)) {
      throw createErrorResponse('Status inválido.', 400)
    }
    if (data.target_date && !isValidDateString(data.target_date)) {
      throw createErrorResponse('Data-alvo deve estar no formato YYYY-MM-DD.', 400)
    }

    const [row] = await db
      .insert(personalGoals)
      .values({
        user_id: userId,
        title: sanitizeString(data.title.trim()),
        description: data.description ? sanitizeString(data.description) : null,
        status: data.status ?? 'planned',
        target_date: data.target_date ? new Date(`${data.target_date}T12:00:00`) : null,
        position: data.position ?? 0,
      })
      .returning()

    return mapGoal(row)
  }

  static async updateGoal(
    id: number,
    userId: number,
    data: Partial<CreatePersonalGoalRequest>
  ): Promise<PersonalGoal> {
    const [existing] = await db
      .select()
      .from(personalGoals)
      .where(and(eq(personalGoals.id, id), eq(personalGoals.user_id, userId)))
      .limit(1)

    if (!existing) throw createErrorResponse('Meta não encontrada.', 404)

    if (data.status !== undefined && !VALID_STATUS.includes(data.status)) {
      throw createErrorResponse('Status inválido.', 400)
    }
    if (data.target_date && !isValidDateString(data.target_date)) {
      throw createErrorResponse('Data-alvo deve estar no formato YYYY-MM-DD.', 400)
    }

    const setData = {
      ...(data.title !== undefined ? { title: sanitizeString(data.title.trim()) } : {}),
      ...(data.description !== undefined
        ? { description: data.description ? sanitizeString(data.description) : null }
        : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.target_date !== undefined
        ? { target_date: data.target_date ? new Date(`${data.target_date}T12:00:00`) : null }
        : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
    }

    if (Object.keys(setData).length === 0) return mapGoal(existing)

    const [row] = await db
      .update(personalGoals)
      .set(setData)
      .where(eq(personalGoals.id, id))
      .returning()

    return mapGoal(row)
  }

  static async deleteGoal(id: number, userId: number): Promise<{ message: string }> {
    const result = await db
      .delete(personalGoals)
      .where(and(eq(personalGoals.id, id), eq(personalGoals.user_id, userId)))
      .returning({ id: personalGoals.id })

    if (result.length === 0) throw createErrorResponse('Meta não encontrada.', 404)

    return { message: 'Meta removida com sucesso.' }
  }
}
