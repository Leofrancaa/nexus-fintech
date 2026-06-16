// Transação crua extraída de um extrato (antes de virar despesa/receita).
export interface ParsedTransaction {
  // Data no formato YYYY-MM-DD.
  date: string
  // Valor com sinal: negativo = saída (despesa), positivo = entrada (receita).
  amount: number
  description: string
}

// Converte valores monetários de extratos (BR e OFX) para número.
// Lida com "1.234,56" (pt-BR), "1234.56" (OFX) e sinais.
export function parseAmount(raw: string | number): number {
  if (typeof raw === 'number') return raw
  let s = String(raw).trim().replace(/\s/g, '')
  if (!s) return NaN

  const negative = s.startsWith('-') || /^\(.*\)$/.test(s)
  s = s.replace(/[()]/g, '').replace(/[^\d.,-]/g, '')

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    // O último separador é o decimal.
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.') // pt-BR: 1.234,56
    } else {
      s = s.replace(/,/g, '') // en: 1,234.56
    }
  } else if (hasComma) {
    s = s.replace(',', '.')
  }

  const n = Math.abs(parseFloat(s))
  if (Number.isNaN(n)) return NaN
  return negative ? -n : n
}
