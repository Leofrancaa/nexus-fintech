import { createHash } from 'node:crypto'

// Normaliza a descrição para o hash (remove acentos, espaços extras, caixa).
function normalizeDesc(desc: string): string {
  return desc
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Hash determinístico de uma transação para evitar reimportação do mesmo
 * lançamento (mesmo usuário + data + valor + tipo + descrição).
 */
export function dedupeHash(params: {
  userId: number
  date: string
  amount: number
  type: 'expense' | 'income'
  description: string
}): string {
  const key = [
    params.userId,
    params.date,
    Math.abs(params.amount).toFixed(2),
    params.type,
    normalizeDesc(params.description),
  ].join('|')
  return createHash('sha256').update(key).digest('hex')
}
