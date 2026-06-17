import { and, eq, asc, desc, sql } from 'drizzle-orm'
import db from '@/server/db/drizzle'
import { chatMessages, expenses, plans } from '@/server/db/schema'
import { createErrorResponse, formatCurrency } from '@/server/utils/helper'
import { chatText, isLlmConfigured, ChatMessage } from '@/server/services/llmService'
import { getSaldoAtual } from '@/server/utils/finance/getSaldoAtual'
import { getGastosPorCategoria } from '@/server/utils/finance/getGastosPorCategoria'

const DAILY_MESSAGE_LIMIT = 4
const HISTORY_LIMIT = 10
const MAX_MESSAGE_LENGTH = 500

interface ChatStatus {
  used: number
  remaining: number
  limit: number
}

interface StoredMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: Date
}

export class ChatService {
  static async messagesUsedToday(userId: number): Promise<number> {
    const [row] = await db
      .select({ c: sql<number>`count(*)` })
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.user_id, userId),
          eq(chatMessages.role, 'user'),
          sql`${chatMessages.created_at}::date = current_date`
        )
      )
    return Number(row?.c ?? 0)
  }

  static async getStatus(userId: number): Promise<ChatStatus> {
    const used = await this.messagesUsedToday(userId)
    return { used, remaining: Math.max(0, DAILY_MESSAGE_LIMIT - used), limit: DAILY_MESSAGE_LIMIT }
  }

  static async getHistory(userId: number, limit = 50): Promise<StoredMessage[]> {
    const rows = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.user_id, userId))
      .orderBy(asc(chatMessages.created_at), asc(chatMessages.id))
      .limit(limit)
    return rows as StoredMessage[]
  }

  // Monta um resumo financeiro compacto do usuário para alimentar a IA.
  private static async buildFinancialContext(userId: number): Promise<string> {
    const now = new Date()
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    const monthTotals = await db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId}
          AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) AS income,
        COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId}
          AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) AS expense
    `)
    const mt = monthTotals.rows[0] as { income: string; expense: string }
    const monthIncome = Number(mt.income)
    const monthExpense = Number(mt.expense)

    const saldoAtual = await getSaldoAtual(userId)
    const topCategorias = await getGastosPorCategoria(userId, mes, ano)

    const [biggest] = await db
      .select({ tipo: expenses.tipo, quantidade: expenses.quantidade, data: expenses.data })
      .from(expenses)
      .where(
        and(
          eq(expenses.user_id, userId),
          sql`EXTRACT(MONTH FROM ${expenses.data}) = ${mes}`,
          sql`EXTRACT(YEAR FROM ${expenses.data}) = ${ano}`
        )
      )
      .orderBy(desc(expenses.quantidade))
      .limit(1)

    const userPlans = await db
      .select({ nome: plans.nome, meta: plans.meta, total: plans.total_contribuido })
      .from(plans)
      .where(eq(plans.user_id, userId))
      .limit(10)

    // Histórico compacto dos últimos 6 meses (para perguntas sobre meses anteriores).
    const historyRows = await db.execute(sql`
      SELECT y, m, SUM(income) AS income, SUM(expense) AS expense
      FROM (
        SELECT EXTRACT(YEAR FROM data)::int AS y, EXTRACT(MONTH FROM data)::int AS m,
               quantidade AS income, 0 AS expense
          FROM incomes WHERE user_id = ${userId}
        UNION ALL
        SELECT EXTRACT(YEAR FROM data)::int AS y, EXTRACT(MONTH FROM data)::int AS m,
               0 AS income, quantidade AS expense
          FROM expenses WHERE user_id = ${userId}
      ) t
      GROUP BY y, m
      ORDER BY y DESC, m DESC
      LIMIT 6
    `)
    const monthly = historyRows.rows as Array<{
      y: number
      m: number
      income: string
      expense: string
    }>

    const mesNome = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    const lines: string[] = [
      `Mês de referência: ${mesNome}.`,
      `Receitas do mês: ${formatCurrency(monthIncome)}.`,
      `Despesas do mês: ${formatCurrency(monthExpense)}.`,
      `Saldo do mês: ${formatCurrency(monthIncome - monthExpense)}.`,
      `Saldo acumulado (todas as movimentações): ${formatCurrency(saldoAtual)}.`,
    ]

    if (biggest) {
      lines.push(`Maior despesa do mês: ${biggest.tipo} — ${formatCurrency(Number(biggest.quantidade))}.`)
    }

    if (monthly.length > 0) {
      const hist = monthly
        .map((r) => {
          const inc = Number(r.income)
          const exp = Number(r.expense)
          return `${String(r.m).padStart(2, '0')}/${r.y}: receitas ${formatCurrency(inc)}, despesas ${formatCurrency(exp)}, saldo ${formatCurrency(inc - exp)}`
        })
        .join('\n')
      lines.push(`Histórico mensal (últimos 6 meses):\n${hist}`)
    }

    if (topCategorias.length > 0) {
      const top = topCategorias
        .slice(0, 5)
        .map((c) => `${c.nome}: ${formatCurrency(Number(c.total))}`)
        .join('; ')
      lines.push(`Gastos por categoria no mês (maiores primeiro): ${top}.`)
    }

    if (userPlans.length > 0) {
      const planLines = userPlans
        .map((p) => {
          const meta = Number(p.meta)
          const total = Number(p.total)
          const pct = meta > 0 ? Math.round((total / meta) * 100) : 0
          return `${p.nome}: ${pct}% (${formatCurrency(total)} de ${formatCurrency(meta)})`
        })
        .join('; ')
      lines.push(`Planos de investimento: ${planLines}.`)
    }

    return lines.join('\n')
  }

  static async sendMessage(
    userId: number,
    message: string
  ): Promise<{ reply: string; status: ChatStatus }> {
    const text = (message ?? '').trim()
    if (!text) throw createErrorResponse('Mensagem vazia.', 400)
    if (text.length > MAX_MESSAGE_LENGTH) {
      throw createErrorResponse(`Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres).`, 400)
    }
    if (!isLlmConfigured()) {
      throw createErrorResponse('O assistente de IA não está configurado no momento.', 503)
    }

    const used = await this.messagesUsedToday(userId)
    if (used >= DAILY_MESSAGE_LIMIT) {
      throw createErrorResponse(
        `Você atingiu o limite de ${DAILY_MESSAGE_LIMIT} mensagens por dia. Tente novamente amanhã.`,
        429
      )
    }

    const context = await this.buildFinancialContext(userId)
    const recent = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.user_id, userId))
      .orderBy(desc(chatMessages.created_at), desc(chatMessages.id))
      .limit(HISTORY_LIMIT)

    const history: ChatMessage[] = recent
      .reverse()
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const system =
      'Você é o assistente financeiro do app Nexus. Responda em português do Brasil, ' +
      'de forma curta, clara e amigável. Use SOMENTE os dados financeiros fornecidos abaixo ' +
      'para responder. Se a informação não estiver nos dados, diga que não tem esse dado. ' +
      'Não invente valores. Dê respostas objetivas e, quando fizer sentido, uma dica prática.\n\n' +
      'DADOS FINANCEIROS DO USUÁRIO:\n' +
      context

    const reply = await chatText(system, [...history, { role: 'user', content: text }])

    // Persiste a mensagem do usuário e a resposta.
    await db.insert(chatMessages).values([
      { user_id: userId, role: 'user', content: text },
      { user_id: userId, role: 'assistant', content: reply },
    ])

    return {
      reply,
      status: {
        used: used + 1,
        remaining: Math.max(0, DAILY_MESSAGE_LIMIT - (used + 1)),
        limit: DAILY_MESSAGE_LIMIT,
      },
    }
  }
}
