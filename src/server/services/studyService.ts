import { and, eq, asc } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { studyItems } from '@/server/db/schema'
import {
  StudyItem,
  CreateStudyItemRequest,
  MilestoneStatus,
  StudyCategory,
} from '@/server/types/index'
import { createErrorResponse, sanitizeString } from '@/server/utils/helper'

const VALID_STATUS: MilestoneStatus[] = ['planned', 'in_progress', 'done']
const VALID_CATEGORY: StudyCategory[] = ['course', 'book', 'certification']

function clampProgress(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.min(100, Math.max(0, Math.round(p)))
}

// Status derivado do progresso quando não informado explicitamente.
function statusFromProgress(progress: number): MilestoneStatus {
  if (progress >= 100) return 'done'
  if (progress > 0) return 'in_progress'
  return 'planned'
}

export class StudyService {
  // Sem seed: cada usuário cria a própria trilha de estudos.
  static async getItems(userId: number): Promise<StudyItem[]> {
    const rows = await db
      .select()
      .from(studyItems)
      .where(eq(studyItems.user_id, userId))
      .orderBy(asc(studyItems.position), asc(studyItems.id))

    return rows as StudyItem[]
  }

  static async createItem(userId: number, data: CreateStudyItemRequest): Promise<StudyItem> {
    if (!data.title || !data.title.trim()) {
      throw createErrorResponse('Título é obrigatório.', 400)
    }
    if (data.category && !VALID_CATEGORY.includes(data.category)) {
      throw createErrorResponse('Categoria inválida.', 400)
    }
    if (data.status && !VALID_STATUS.includes(data.status)) {
      throw createErrorResponse('Status inválido.', 400)
    }

    const progress = data.progress !== undefined ? clampProgress(data.progress) : 0

    const [row] = await db
      .insert(studyItems)
      .values({
        user_id: userId,
        title: sanitizeString(data.title.trim()),
        description: data.description ? sanitizeString(data.description) : null,
        category: data.category ?? null,
        resource_url: data.resource_url ?? null,
        progress,
        status: data.status ?? statusFromProgress(progress),
        position: data.position ?? 0,
      })
      .returning()

    return row as StudyItem
  }

  static async updateItem(
    id: number,
    userId: number,
    data: Partial<CreateStudyItemRequest>
  ): Promise<StudyItem> {
    const [existing] = await db
      .select()
      .from(studyItems)
      .where(and(eq(studyItems.id, id), eq(studyItems.user_id, userId)))
      .limit(1)

    if (!existing) throw createErrorResponse('Item de estudo não encontrado.', 404)

    if (data.category !== undefined && data.category !== null && !VALID_CATEGORY.includes(data.category)) {
      throw createErrorResponse('Categoria inválida.', 400)
    }
    if (data.status !== undefined && !VALID_STATUS.includes(data.status)) {
      throw createErrorResponse('Status inválido.', 400)
    }

    // Progresso e status andam juntos: atualizar progresso sincroniza o status
    // quando o status não foi informado explicitamente.
    const hasProgress = data.progress !== undefined
    const progress = hasProgress ? clampProgress(data.progress!) : undefined

    const setData = {
      ...(data.title !== undefined ? { title: sanitizeString(data.title.trim()) } : {}),
      ...(data.description !== undefined
        ? { description: data.description ? sanitizeString(data.description) : null }
        : {}),
      ...(data.category !== undefined ? { category: data.category } : {}),
      ...(data.resource_url !== undefined ? { resource_url: data.resource_url } : {}),
      ...(progress !== undefined ? { progress } : {}),
      ...(data.status !== undefined
        ? { status: data.status }
        : progress !== undefined
          ? { status: statusFromProgress(progress) }
          : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
    }

    if (Object.keys(setData).length === 0) return existing as StudyItem

    const [row] = await db
      .update(studyItems)
      .set(setData)
      .where(eq(studyItems.id, id))
      .returning()

    return row as StudyItem
  }

  static async deleteItem(id: number, userId: number): Promise<{ message: string }> {
    const result = await db
      .delete(studyItems)
      .where(and(eq(studyItems.id, id), eq(studyItems.user_id, userId)))
      .returning({ id: studyItems.id })

    if (result.length === 0) throw createErrorResponse('Item de estudo não encontrado.', 404)

    return { message: 'Item removido com sucesso.' }
  }
}
