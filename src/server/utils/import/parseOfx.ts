import { ParsedTransaction, parseAmount } from './types'

// Extrai o valor de uma tag OFX (SGML, geralmente sem fechamento):
//   <TRNAMT>-50.00\n  ou  <MEMO>Compra\n
function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}>([^<\r\n]*)`, 'i'))
  return m ? m[1].trim() : null
}

// Converte DTPOSTED (YYYYMMDD[HHMMSS][.fff][TZ]) para YYYY-MM-DD.
function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null
  const m = raw.match(/(\d{4})(\d{2})(\d{2})/)
  if (!m) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/**
 * Parser determinístico de OFX. Cobre os bancos brasileiros que exportam OFX
 * (Nubank, BB, Santander, Bradesco, Itaú). Não usa IA.
 */
export function parseOfx(content: string): ParsedTransaction[] {
  const blocks = content.split(/<STMTTRN>/i).slice(1)
  const transactions: ParsedTransaction[] = []

  for (const raw of blocks) {
    const block = raw.split(/<\/STMTTRN>/i)[0]
    const date = parseOfxDate(tag(block, 'DTPOSTED'))
    const amountRaw = tag(block, 'TRNAMT')
    const description = tag(block, 'MEMO') || tag(block, 'NAME') || 'Sem descrição'

    if (!date || amountRaw === null) continue

    const amount = parseAmount(amountRaw)
    if (Number.isNaN(amount) || amount === 0) continue

    transactions.push({ date, amount, description: description.trim() })
  }

  return transactions
}
