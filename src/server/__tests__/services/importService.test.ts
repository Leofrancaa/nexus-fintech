import { describe, it, expect, beforeEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { ImportService } from '@/server/services/importService'

const USER_ID = 1

const OFX = `<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250105<TRNAMT>-50.00<MEMO>UBER *TRIP</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20250106<TRNAMT>-80.00<MEMO>IFOOD PEDIDO</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20250110<TRNAMT>3000.00<MEMO>SALARIO EMPRESA</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

let transporteId: number
let receitaId: number

beforeEach(async () => {
  const inserted = await db
    .insert(schema.categories)
    .values([
      { nome: 'Transporte', cor: '#111111', tipo: 'despesa', user_id: USER_ID },
      { nome: 'Alimentação', cor: '#222222', tipo: 'despesa', user_id: USER_ID },
      { nome: 'Salário', cor: '#333333', tipo: 'receita', user_id: USER_ID },
    ])
    .returning()
  transporteId = inserted.find((c) => c.nome === 'Transporte')!.id
  receitaId = inserted.find((c) => c.nome === 'Salário')!.id
})

describe('ImportService.createImport (OFX)', () => {
  it('faz parse, define tipos e categoriza por regras', async () => {
    const result = await ImportService.createImport({
      userId: USER_ID,
      source: 'extrato.ofx',
      format: 'ofx',
      ofxText: OFX,
    })

    expect(result.summary.total).toBe(3)
    const uber = result.transactions.find((t) => t.description.includes('UBER'))!
    const salario = result.transactions.find((t) => t.description.includes('SALARIO'))!

    expect(uber.type).toBe('expense')
    expect(uber.amount).toBe(50)
    expect(uber.suggested_category_id).toBe(transporteId)

    expect(salario.type).toBe('income')
    expect(salario.amount).toBe(3000)
    expect(salario.suggested_category_id).toBe(receitaId)
  })

  it('rejeita extrato sem transações', async () => {
    await expect(
      ImportService.createImport({ userId: USER_ID, source: 'x.ofx', format: 'ofx', ofxText: '<OFX></OFX>' })
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('ImportService.confirmImport', () => {
  it('cria despesas e receitas reais a partir das transações pendentes', async () => {
    const { batch } = await ImportService.createImport({
      userId: USER_ID,
      source: 'extrato.ofx',
      format: 'ofx',
      ofxText: OFX,
    })

    const result = await ImportService.confirmImport(batch.id, USER_ID)
    expect(result.created_expenses).toBe(2)
    expect(result.created_incomes).toBe(1)

    const exp = await db.select().from(schema.expenses).where(eq(schema.expenses.user_id, USER_ID))
    const inc = await db.select().from(schema.incomes).where(eq(schema.incomes.user_id, USER_ID))
    expect(exp).toHaveLength(2)
    expect(inc).toHaveLength(1)

    const [reloaded] = await db
      .select()
      .from(schema.importBatches)
      .where(eq(schema.importBatches.id, batch.id))
    expect(reloaded.status).toBe('confirmed')
  })

  it('não confirma duas vezes', async () => {
    const { batch } = await ImportService.createImport({
      userId: USER_ID,
      source: 'e.ofx',
      format: 'ofx',
      ofxText: OFX,
    })
    await ImportService.confirmImport(batch.id, USER_ID)
    await expect(ImportService.confirmImport(batch.id, USER_ID)).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('ImportService dedupe', () => {
  it('marca como duplicada uma transação já confirmada em import anterior', async () => {
    const first = await ImportService.createImport({
      userId: USER_ID,
      source: 'e1.ofx',
      format: 'ofx',
      ofxText: OFX,
    })
    await ImportService.confirmImport(first.batch.id, USER_ID)

    const second = await ImportService.createImport({
      userId: USER_ID,
      source: 'e2.ofx',
      format: 'ofx',
      ofxText: OFX,
    })
    expect(second.summary.duplicates).toBe(3)
    expect(second.transactions.every((t) => t.status === 'duplicate')).toBe(true)
  })
})

describe('ImportService.updateTransaction', () => {
  it('atualiza tipo, categoria e status de inclusão', async () => {
    const { transactions } = await ImportService.createImport({
      userId: USER_ID,
      source: 'e.ofx',
      format: 'ofx',
      ofxText: OFX,
    })
    const tx = transactions[0]

    const updated = await ImportService.updateTransaction(tx.id, USER_ID, { status: 'skipped' })
    expect(updated.status).toBe('skipped')
  })

  it('404 para transação inexistente', async () => {
    await expect(
      ImportService.updateTransaction(999, USER_ID, { status: 'skipped' })
    ).rejects.toMatchObject({ status: 404 })
  })
})
