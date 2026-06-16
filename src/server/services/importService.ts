import { and, eq, desc, inArray, gte, sql, count } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import {
  importBatches,
  importedTransactions,
  categories,
  expenses,
  incomes,
} from '@/server/db/schema'
import { createErrorResponse } from '@/server/utils/helper'
import { parseOfx } from '@/server/utils/import/parseOfx'
import { parsePdf } from '@/server/utils/import/parsePdf'
import { dedupeHash } from '@/server/utils/import/dedupe'
import {
  categorizeByRules,
  categorizeWithLlm,
  UserCategory,
} from '@/server/utils/import/categorize'
import type { ParsedTransaction } from '@/server/utils/import/types'

type ImportFormat = 'ofx' | 'pdf'
type TxType = 'expense' | 'income'

// Importação por PDF é limitada a 1x por semana por usuário (usa IA).
const PDF_WEEKLY_LIMIT = 1

interface CreateImportInput {
  userId: number
  source: string
  format: ImportFormat
  ofxText?: string
  pdfBuffer?: ArrayBuffer
}

export class ImportService {
  // Quantos PDFs o usuário importou nos últimos 7 dias.
  static async pdfImportsThisWeek(userId: number): Promise<number> {
    const [row] = await db
      .select({ c: count() })
      .from(importBatches)
      .where(
        and(
          eq(importBatches.user_id, userId),
          eq(importBatches.format, 'pdf'),
          gte(importBatches.created_at, sql`now() - interval '7 days'`)
        )
      )
    return Number(row?.c ?? 0)
  }

  static async createImport(input: CreateImportInput) {
    const { userId, source, format } = input

    // Limite semanal de PDF (1x/semana) — barra antes de gastar a chamada de IA.
    if (format === 'pdf') {
      const used = await this.pdfImportsThisWeek(userId)
      if (used >= PDF_WEEKLY_LIMIT) {
        throw createErrorResponse(
          'Você já usou sua importação de PDF desta semana. Tente novamente em alguns dias ou use um arquivo OFX.',
          429
        )
      }
    }

    // 1) Parse (determinístico p/ OFX, texto+IA p/ PDF)
    let parsed: ParsedTransaction[]
    if (format === 'ofx') {
      if (!input.ofxText) throw createErrorResponse('Arquivo OFX vazio.', 400)
      parsed = parseOfx(input.ofxText)
    } else if (format === 'pdf') {
      if (!input.pdfBuffer) throw createErrorResponse('Arquivo PDF vazio.', 400)
      parsed = await parsePdf(input.pdfBuffer)
    } else {
      throw createErrorResponse('Formato não suportado. Use OFX ou PDF.', 400)
    }

    if (parsed.length === 0) {
      throw createErrorResponse('Nenhuma transação encontrada no extrato.', 400)
    }

    // 2) Categorias do usuário (para sugerir categoria)
    const userCategories = (await db
      .select({ id: categories.id, nome: categories.nome, tipo: categories.tipo })
      .from(categories)
      .where(eq(categories.user_id, userId))) as UserCategory[]

    // 3) Normaliza tipo + categoriza por regras
    const items = parsed.map((p) => {
      const type: TxType = p.amount < 0 ? 'expense' : 'income'
      const amount = Math.abs(p.amount)
      const suggested = categorizeByRules({ description: p.description, type }, userCategories)
      return { date: p.date, amount, type, description: p.description, suggested }
    })

    // 4) IA só para os que as regras não resolveram (1 chamada em lote)
    const unresolved = items
      .map((it, index) => ({ index, description: it.description, type: it.type }))
      .filter((it) => items[it.index].suggested === null)

    const llmMap = await categorizeWithLlm(unresolved, userCategories)
    unresolved.forEach((u) => {
      if (llmMap[u.index] !== undefined) items[u.index].suggested = llmMap[u.index]
    })

    // 5) Dedupe: hashes já confirmados pelo usuário em importações anteriores
    const hashes = items.map((it) =>
      dedupeHash({ userId, date: it.date, amount: it.amount, type: it.type, description: it.description })
    )

    const existing = await db
      .select({ dedupe_hash: importedTransactions.dedupe_hash })
      .from(importedTransactions)
      .where(
        and(
          eq(importedTransactions.user_id, userId),
          eq(importedTransactions.status, 'confirmed'),
          inArray(importedTransactions.dedupe_hash, hashes.length ? hashes : ['']) // evita IN vazio
        )
      )
    const confirmedHashes = new Set(existing.map((e) => e.dedupe_hash))
    const seenInBatch = new Set<string>()

    // 6) Persiste o lote + transações
    return await db.transaction(async (tx) => {
      const [batch] = await tx
        .insert(importBatches)
        .values({ user_id: userId, source, format, status: 'pending' })
        .returning()

      const rows = items.map((it, i) => {
        const hash = hashes[i]
        const isDuplicate = confirmedHashes.has(hash) || seenInBatch.has(hash)
        seenInBatch.add(hash)
        return {
          batch_id: batch.id,
          user_id: userId,
          date: new Date(`${it.date}T12:00:00`),
          amount: String(it.amount),
          description: it.description,
          type: it.type,
          suggested_category_id: it.suggested,
          category_id: it.suggested,
          status: isDuplicate ? 'duplicate' : 'pending',
          dedupe_hash: hash,
        }
      })

      const inserted = await tx.insert(importedTransactions).values(rows).returning()

      return {
        batch,
        transactions: inserted.map((t) => ({ ...t, amount: Number(t.amount) })),
        summary: {
          total: inserted.length,
          duplicates: inserted.filter((t) => t.status === 'duplicate').length,
        },
      }
    })
  }

  static async getBatch(batchId: number, userId: number) {
    const [batch] = await db
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, batchId), eq(importBatches.user_id, userId)))
      .limit(1)

    if (!batch) throw createErrorResponse('Importação não encontrada.', 404)

    const transactions = await db
      .select()
      .from(importedTransactions)
      .where(eq(importedTransactions.batch_id, batchId))
      .orderBy(desc(importedTransactions.date), desc(importedTransactions.id))

    return { batch, transactions: transactions.map((t) => ({ ...t, amount: Number(t.amount) })) }
  }

  static async listBatches(userId: number, limit = 10) {
    return db
      .select()
      .from(importBatches)
      .where(eq(importBatches.user_id, userId))
      .orderBy(desc(importBatches.created_at))
      .limit(limit)
  }

  static async updateTransaction(
    txId: number,
    userId: number,
    data: { type?: TxType; category_id?: number | null; status?: 'pending' | 'skipped' }
  ) {
    const [existing] = await db
      .select()
      .from(importedTransactions)
      .where(and(eq(importedTransactions.id, txId), eq(importedTransactions.user_id, userId)))
      .limit(1)

    if (!existing) throw createErrorResponse('Transação não encontrada.', 404)

    if (data.type && data.type !== 'expense' && data.type !== 'income') {
      throw createErrorResponse('Tipo inválido.', 400)
    }
    if (data.status && data.status !== 'pending' && data.status !== 'skipped') {
      throw createErrorResponse('Status inválido.', 400)
    }

    const setData = {
      ...(data.type !== undefined ? { type: data.type } : {}),
      ...(data.category_id !== undefined ? { category_id: data.category_id } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    }

    if (Object.keys(setData).length === 0) return { ...existing, amount: Number(existing.amount) }

    const [row] = await db
      .update(importedTransactions)
      .set(setData)
      .where(eq(importedTransactions.id, txId))
      .returning()

    return { ...row, amount: Number(row.amount) }
  }

  // Confirma o lote: cria despesas/receitas reais a partir das transações pendentes.
  static async confirmImport(batchId: number, userId: number) {
    return await db.transaction(async (tx) => {
      const [batch] = await tx
        .select()
        .from(importBatches)
        .where(and(eq(importBatches.id, batchId), eq(importBatches.user_id, userId)))
        .limit(1)

      if (!batch) throw createErrorResponse('Importação não encontrada.', 404)
      if (batch.status === 'confirmed') {
        throw createErrorResponse('Esta importação já foi confirmada.', 400)
      }

      const pending = await tx
        .select()
        .from(importedTransactions)
        .where(
          and(
            eq(importedTransactions.batch_id, batchId),
            eq(importedTransactions.status, 'pending')
          )
        )

      let createdExpenses = 0
      let createdIncomes = 0

      for (const t of pending) {
        const amount = Number(t.amount)
        if (t.type === 'expense') {
          await tx.insert(expenses).values({
            metodo_pagamento: 'importado',
            tipo: t.description.slice(0, 120),
            quantidade: String(amount),
            fixo: false,
            data: t.date,
            user_id: userId,
            category_id: t.category_id ?? null,
            observacoes: 'Importado de extrato',
          })
          createdExpenses++
        } else {
          await tx.insert(incomes).values({
            tipo: t.description.slice(0, 120),
            quantidade: String(amount),
            fixo: false,
            data: t.date,
            fonte: 'Importado de extrato',
            user_id: userId,
            category_id: t.category_id ?? null,
          })
          createdIncomes++
        }
      }

      const pendingIds = pending.map((p) => p.id)
      if (pendingIds.length > 0) {
        await tx
          .update(importedTransactions)
          .set({ status: 'confirmed' })
          .where(inArray(importedTransactions.id, pendingIds))
      }

      await tx
        .update(importBatches)
        .set({ status: 'confirmed' })
        .where(eq(importBatches.id, batchId))

      return {
        message: 'Importação confirmada com sucesso.',
        created_expenses: createdExpenses,
        created_incomes: createdIncomes,
      }
    })
  }
}
