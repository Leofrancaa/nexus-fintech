import { extractText, getDocumentProxy } from 'unpdf'
import { ParsedTransaction, parseAmount } from './types'
import { chatJson, isLlmConfigured } from '@/server/services/llmService'
import { createErrorResponse } from '@/server/utils/helper'

// Limite de texto enviado à LLM (extratos pessoais cabem com folga).
const MAX_CHARS = 24000

interface LlmTransaction {
  date: string
  amount: number | string
  description: string
}

/**
 * Extrai transações de um PDF de extrato (ex.: Mercado Pago).
 * Passo 1: extrai o texto com unpdf (sem IA).
 * Passo 2: usa a LLM (Groq/Qwen) para estruturar o texto em transações.
 */
export async function parsePdf(buffer: ArrayBuffer | Uint8Array): Promise<ParsedTransaction[]> {
  if (!isLlmConfigured()) {
    throw createErrorResponse(
      'Para importar PDF é necessário configurar a IA (GROQ_API_KEY). Use OFX para importar sem IA.',
      400
    )
  }

  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const pdf = await getDocumentProxy(data)
  const { text } = await extractText(pdf, { mergePages: true })
  const fullText = Array.isArray(text) ? text.join('\n') : text

  if (!fullText || !fullText.trim()) {
    throw createErrorResponse('Não foi possível extrair texto do PDF.', 400)
  }

  const system =
    'Você extrai transações financeiras de extratos bancários. ' +
    'Responda APENAS com JSON válido, sem comentários.'

  const user =
    'A seguir está o texto de um extrato bancário (pt-BR). Extraia TODAS as transações. ' +
    'Para cada uma retorne: "date" (YYYY-MM-DD), "amount" (número; NEGATIVO para saídas/débitos/pagamentos, ' +
    'POSITIVO para entradas/créditos/recebimentos) e "description" (texto curto). ' +
    'Ignore saldos, totais e cabeçalhos. ' +
    'Formato exato: {"transactions":[{"date":"2025-01-05","amount":-50.0,"description":"..."}]}\n\n' +
    'EXTRATO:\n' +
    fullText.slice(0, MAX_CHARS)

  const result = await chatJson<{ transactions?: LlmTransaction[] }>({
    system,
    user,
    maxTokens: 4096,
  })

  const list = Array.isArray(result?.transactions) ? result.transactions : []

  return list
    .map((t) => ({
      date: String(t.date ?? '').slice(0, 10),
      amount: parseAmount(t.amount),
      description: String(t.description ?? '').trim() || 'Sem descrição',
    }))
    .filter(
      (t) => /^\d{4}-\d{2}-\d{2}$/.test(t.date) && !Number.isNaN(t.amount) && t.amount !== 0
    )
}
