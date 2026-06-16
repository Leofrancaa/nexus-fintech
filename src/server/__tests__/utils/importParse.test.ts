import { describe, it, expect } from 'vitest'
import { parseOfx } from '@/server/utils/import/parseOfx'
import { parseAmount } from '@/server/utils/import/types'
import { dedupeHash } from '@/server/utils/import/dedupe'

describe('parseAmount', () => {
  it('lê formato OFX (ponto decimal) com sinal', () => {
    expect(parseAmount('-50.00')).toBe(-50)
    expect(parseAmount('3000.00')).toBe(3000)
  })

  it('lê formato pt-BR (1.234,56)', () => {
    expect(parseAmount('1.234,56')).toBeCloseTo(1234.56)
    expect(parseAmount('-1.234,56')).toBeCloseTo(-1234.56)
  })

  it('lê valor com símbolo e parênteses como negativo', () => {
    expect(parseAmount('R$ 100,00')).toBe(100)
    expect(parseAmount('(80,00)')).toBe(-80)
  })
})

describe('parseOfx', () => {
  const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250105120000<TRNAMT>-50.00<MEMO>UBER *TRIP</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20250110<TRNAMT>3000.00<MEMO>SALARIO EMPRESA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250112<TRNAMT>0.00<MEMO>SALDO</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

  it('extrai transações válidas e ignora valor zero', () => {
    const txs = parseOfx(OFX)
    expect(txs).toHaveLength(2)
    expect(txs[0]).toMatchObject({ date: '2025-01-05', amount: -50, description: 'UBER *TRIP' })
    expect(txs[1]).toMatchObject({ date: '2025-01-10', amount: 3000 })
  })

  it('retorna vazio para conteúdo sem transações', () => {
    expect(parseOfx('<OFX></OFX>')).toEqual([])
  })
})

describe('dedupeHash', () => {
  it('é estável para a mesma transação e diferente entre transações distintas', () => {
    const base = { userId: 1, date: '2025-01-05', amount: 50, type: 'expense' as const, description: 'UBER' }
    expect(dedupeHash(base)).toBe(dedupeHash({ ...base, description: 'uber' })) // normaliza caixa
    expect(dedupeHash(base)).not.toBe(dedupeHash({ ...base, amount: 51 }))
  })
})
