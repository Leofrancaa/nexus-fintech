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

/**
 * Faz uma chamada de chat e devolve o JSON parseado da resposta.
 * Lança erro se a IA não estiver configurada ou a chamada falhar — o chamador
 * deve tratar e cair no fallback (regras).
 */
export async function chatJson<T = unknown>({ system, user, maxTokens = 2048 }: ChatOptions): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY não configurada.')

  const baseUrl = process.env.GROQ_BASE_URL || DEFAULT_BASE_URL
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`LLM respondeu ${res.status}: ${detail.slice(0, 200)}`)
    }

    const data = await res.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    if (!content) throw new Error('Resposta vazia da LLM.')

    return JSON.parse(extractJson(content)) as T
  } finally {
    clearTimeout(timeout)
  }
}
