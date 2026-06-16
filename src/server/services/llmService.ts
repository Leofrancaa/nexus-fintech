/**
 * Cliente de LLM agnóstico de provedor — usado para estruturar PDFs de extrato
 * e categorizar transações. Por padrão aponta para o Groq (API gratuita,
 * compatível com o formato OpenAI) com um modelo Qwen.
 *
 * Configuração via ambiente:
 *   GROQ_API_KEY   — obrigatória para habilitar a IA (sem ela, o sistema usa
 *                    apenas regras por palavra-chave).
 *   GROQ_MODEL     — opcional; default 'qwen/qwen3-32b'. Veja os modelos atuais
 *                    em https://console.groq.com/docs/models
 *   GROQ_BASE_URL  — opcional; permite trocar de provedor (ex.: outro endpoint
 *                    compatível com OpenAI).
 */

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1'
const DEFAULT_MODEL = 'qwen/qwen3-32b'

export function isLlmConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY)
}

interface ChatOptions {
  system: string
  user: string
  /** Tokens máximos da resposta. */
  maxTokens?: number
}

// Remove cercas de código (```json ... ```) e ruído antes/depois do JSON.
function extractJson(content: string): string {
  let text = content.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()

  const firstBrace = text.search(/[[{]/)
  const lastBrace = Math.max(text.lastIndexOf(']'), text.lastIndexOf('}'))
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    text = text.slice(firstBrace, lastBrace + 1)
  }
  return text
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Chamada base de chat — devolve o texto bruto da resposta.
async function callChat(
  messages: ChatMessage[],
  maxTokens: number,
  temperature = 0.3
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada.')

  const baseUrl = process.env.GROQ_BASE_URL || DEFAULT_BASE_URL
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  // Modelos Qwen3 (raciocínio) gastam muitos tokens "pensando" e estouram o
  // limite do free tier. Desliga o raciocínio quando suportado.
  const body: Record<string, unknown> = { model, temperature, max_tokens: maxTokens, messages }
  if (/qwen/i.test(model)) body.reasoning_effort = 'none'

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`LLM respondeu ${res.status}: ${detail.slice(0, 200)}`)
    }

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    if (!content) throw new Error('Resposta vazia da LLM.')
    return content
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Faz uma chamada de chat e devolve o JSON parseado da resposta.
 * Lança erro se a IA não estiver configurada ou a chamada falhar — o chamador
 * deve tratar e cair no fallback (regras).
 */
export async function chatJson<T = unknown>({ system, user, maxTokens = 2048 }: ChatOptions): Promise<T> {
  const content = await callChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    maxTokens,
    0 // determinístico para extração de JSON
  )
  return JSON.parse(extractJson(content)) as T
}

/**
 * Chat em texto livre (assistente). Recebe a mensagem de sistema e o histórico.
 * Remove blocos de raciocínio <think>...</think> que alguns modelos Qwen emitem.
 */
export async function chatText(
  system: string,
  history: ChatMessage[],
  maxTokens = 700
): Promise<string> {
  const content = await callChat([{ role: 'system', content: system }, ...history], maxTokens)
  return content.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
}
