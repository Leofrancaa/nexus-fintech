import { normalize } from '@/server/utils/helper'
import { chatJson, isLlmConfigured } from '@/server/services/llmService'

export interface UserCategory {
  id: number
  nome: string
  tipo: string // 'despesa' | 'receita'
}

export interface CategorizableItem {
  description: string
  type: 'expense' | 'income'
}

// Palavra-chave (sem acento) -> nome genérico de categoria (pt-BR).
const KEYWORD_RULES: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['uber', '99 ', '99app', 'cabify', 'posto', 'shell', 'ipiranga', 'combustivel', 'estacionamento', 'metro', 'onibus', 'passagem'], category: 'transporte' },
  { keywords: ['ifood', 'rappi', 'restaurante', 'lanchonete', 'padaria', 'mercado', 'supermercado', 'hortifruti', 'acougue', 'mc donalds', 'burger', 'pizza'], category: 'alimentacao' },
  { keywords: ['aluguel', 'condominio', 'luz', 'energia', 'agua', 'gas', 'enel', 'sabesp', 'imobiliaria'], category: 'moradia' },
  { keywords: ['farmacia', 'drogaria', 'hospital', 'clinica', 'medico', 'laboratorio', 'plano de saude', 'unimed'], category: 'saude' },
  { keywords: ['netflix', 'spotify', 'disney', 'hbo', 'prime video', 'cinema', 'show', 'bar ', 'steam', 'playstation', 'xbox'], category: 'lazer' },
  { keywords: ['escola', 'faculdade', 'curso', 'udemy', 'alura', 'coursera', 'livro', 'mensalidade'], category: 'educacao' },
  { keywords: ['amazon', 'mercado livre', 'shopee', 'aliexpress', 'magazine', 'americanas', 'loja', 'shopping'], category: 'compras' },
  { keywords: ['vivo', 'claro', 'tim', 'oi ', 'internet', 'telefone', 'celular'], category: 'servicos' },
]

const INCOME_RULES: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['salario', 'pagamento', 'pix recebido', 'transferencia recebida', 'ted recebida', 'rendimento', 'cashback', 'estorno'], category: 'salario' },
]

function resolveCategory(
  generic: string,
  userCategories: UserCategory[],
  tipo: 'despesa' | 'receita'
): number | null {
  const target = normalize(generic)
  const match = userCategories.find(
    (c) => c.tipo === tipo && (normalize(c.nome) === target || normalize(c.nome).includes(target))
  )
  return match?.id ?? null
}

// Categorização por regras (grátis, sem IA). Retorna id da categoria ou null.
export function categorizeByRules(
  item: CategorizableItem,
  userCategories: UserCategory[]
): number | null {
  const desc = normalize(item.description)
  const rules = item.type === 'income' ? INCOME_RULES : KEYWORD_RULES
  const tipo = item.type === 'income' ? 'receita' : 'despesa'

  for (const rule of rules) {
    if (rule.keywords.some((k) => desc.includes(normalize(k)))) {
      const id = resolveCategory(rule.category, userCategories, tipo)
      if (id) return id
    }
  }
  return null
}

/**
 * Categoriza com a LLM os itens que as regras não resolveram.
 * Recebe os índices originais para devolver um mapa index -> category_id.
 * Falha silenciosamente (retorna {}) se a IA não estiver configurada.
 */
export async function categorizeWithLlm(
  items: Array<{ index: number; description: string; type: 'expense' | 'income' }>,
  userCategories: UserCategory[]
): Promise<Record<number, number>> {
  if (!isLlmConfigured() || items.length === 0 || userCategories.length === 0) return {}

  const catList = userCategories
    .map((c) => `${c.id}: ${c.nome} (${c.tipo})`)
    .join('\n')

  const txList = items
    .map((it) => `${it.index}: [${it.type === 'income' ? 'entrada' : 'saida'}] ${it.description}`)
    .join('\n')

  const system =
    'Você categoriza transações financeiras. Responda APENAS com JSON válido.'
  const user =
    'Categorias disponíveis (id: nome (tipo)):\n' +
    catList +
    '\n\nTransações (indice: [tipo] descrição):\n' +
    txList +
    '\n\nPara cada transação, escolha a categoria mais adequada do MESMO tipo ' +
    '(saida=despesa, entrada=receita). Se nenhuma servir, use null. ' +
    'Formato exato: {"assignments":[{"index":0,"category_id":12}]}'

  try {
    const result = await chatJson<{
      assignments?: Array<{ index: number; category_id: number | null }>
    }>({ system, user, maxTokens: 2048 })

    const map: Record<number, number> = {}
    const validIds = new Set(userCategories.map((c) => c.id))
    for (const a of result?.assignments ?? []) {
      if (a && typeof a.index === 'number' && a.category_id && validIds.has(a.category_id)) {
        map[a.index] = a.category_id
      }
    }
    return map
  } catch {
    return {} // fallback silencioso para regras/sem categoria
  }
}
