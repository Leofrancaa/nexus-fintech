/**
 * Serviço de taxa Selic em tempo real via API do Banco Central (SGS).
 *
 * Série 432 = Meta Selic definida pelo Copom (% a.a.).
 * Endpoint: https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json
 *
 * A resposta é cacheada em memória (TTL) para evitar bater na API a cada request.
 * Em caso de falha, retorna um fallback conservador.
 */

const BCB_SELIC_URL =
  'https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json'

// Fallback usado quando a API do BCB está indisponível.
const SELIC_FALLBACK = 10.5

// TTL do cache: 12 horas.
const CACHE_TTL_MS = 12 * 60 * 60 * 1000

interface SelicCache {
  valor: number
  fonte: 'bcb' | 'fallback'
  atualizadoEm: number
}

const globalForSelic = globalThis as unknown as { selicCache?: SelicCache }

interface BcbResponseItem {
  data: string
  valor: string
}

function parseSelicResponse(payload: unknown): number | null {
  if (!Array.isArray(payload) || payload.length === 0) return null
  const item = payload[0] as Partial<BcbResponseItem>
  if (!item || typeof item.valor !== 'string') return null
  const valor = Number(item.valor.replace(',', '.'))
  if (!Number.isFinite(valor) || valor <= 0 || valor > 100) return null
  return valor
}

export interface SelicInfo {
  /** Taxa Selic anual em % a.a. */
  valor: number
  /** Origem do dado: API do BCB ou fallback. */
  fonte: 'bcb' | 'fallback'
  /** Timestamp (ms) da última atualização do cache. */
  atualizadoEm: number
}

/**
 * Retorna a Selic atual (% a.a.), usando cache em memória com TTL.
 */
export async function getSelicAnual(): Promise<SelicInfo> {
  const cache = globalForSelic.selicCache
  const agora = Date.now()

  if (cache && agora - cache.atualizadoEm < CACHE_TTL_MS) {
    return { valor: cache.valor, fonte: cache.fonte, atualizadoEm: cache.atualizadoEm }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(BCB_SELIC_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(timeout)

    if (!res.ok) throw new Error(`BCB respondeu ${res.status}`)

    const payload = await res.json()
    const valor = parseSelicResponse(payload)
    if (valor === null) throw new Error('Resposta do BCB em formato inesperado.')

    const novoCache: SelicCache = { valor, fonte: 'bcb', atualizadoEm: agora }
    globalForSelic.selicCache = novoCache
    return { ...novoCache }
  } catch {
    // Falha de rede/parsing: usa cache antigo se houver, senão fallback.
    if (cache) {
      return { valor: cache.valor, fonte: cache.fonte, atualizadoEm: cache.atualizadoEm }
    }
    const fallback: SelicCache = {
      valor: SELIC_FALLBACK,
      fonte: 'fallback',
      atualizadoEm: agora,
    }
    globalForSelic.selicCache = fallback
    return { ...fallback }
  }
}
