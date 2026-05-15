import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { IncomeService } from '@/server/services/incomeService'

const USER_ID = 1

function makeIncomeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    tipo: 'Salário',
    quantidade: 3000,
    nota: null,
    data: new Date('2025-01-05'),
    fonte: null,
    fixo: false,
    user_id: USER_ID,
    category_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()
})

describe('IncomeService.createIncome — receita simples', () => {
  it('cria receita não fixa sem replicação', async () => {
    const record = makeIncomeRecord()
    prismaMock.income.create.mockResolvedValue(record as never)

    const result = await IncomeService.createIncome(
      { tipo: 'Salário', quantidade: 3000 },
      USER_ID
    )

    expect(prismaMock.income.create).toHaveBeenCalledOnce()
    expect(Array.isArray(result)).toBe(false)
    expect((result as { quantidade: number }).quantidade).toBe(3000)
  })

  it('passa category_id quando fornecido', async () => {
    const record = makeIncomeRecord({ category_id: 5 })
    prismaMock.income.create.mockResolvedValue(record as never)

    await IncomeService.createIncome(
      { tipo: 'Freelance', quantidade: 500, category_id: 5 },
      USER_ID
    )

    const createCall = prismaMock.income.create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(createCall.data.category_id).toBe(5)
  })
})

describe('IncomeService.createIncome — receita fixa', () => {
  it('cria receita base e replica para os meses restantes do ano', async () => {
    const baseRecord = makeIncomeRecord({ fixo: true, data: new Date('2025-01-05') })
    // Cada create chamado: base + 11 réplicas (Fev-Dez)
    prismaMock.income.create.mockResolvedValue(baseRecord as never)

    const result = await IncomeService.createIncome(
      { tipo: 'Aluguel', quantidade: 1200, fixo: true, data: '2025-01-05' },
      USER_ID
    )

    // 1 (base) + 11 (réplicas fev a dez) = 12 chamadas ao income.create
    expect(prismaMock.income.create).toHaveBeenCalledTimes(12)
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(12)
  })

  it('não replica quando a receita começa em dezembro — retorna array de 1 elemento', async () => {
    // fixo=true sempre retorna array, mas sem réplicas quando começa em Dez
    const record = makeIncomeRecord({ fixo: true, data: new Date('2025-12-01') })
    prismaMock.income.create.mockResolvedValue(record as never)

    const result = await IncomeService.createIncome(
      { tipo: 'Aluguel', quantidade: 1200, fixo: true, data: '2025-12-01' },
      USER_ID
    )

    expect(prismaMock.income.create).toHaveBeenCalledTimes(1)
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(1) // só o base, sem réplicas
  })
})

describe('IncomeService.deleteIncome', () => {
  it('deleta receita simples', async () => {
    const income = makeIncomeRecord({ fixo: false })
    prismaMock.income.findFirst.mockResolvedValue(income as never)
    prismaMock.income.delete.mockResolvedValue(income as never)

    const result = await IncomeService.deleteIncome(1, USER_ID)

    expect(prismaMock.income.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect((result as { id: number }).id).toBe(1)
  })

  it('deleta receita fixa e todas as do mesmo tipo', async () => {
    const income = makeIncomeRecord({ fixo: true, tipo: 'Aluguel' })
    const toDelete = [income, makeIncomeRecord({ id: 2, fixo: true })]

    prismaMock.income.findFirst.mockResolvedValue(income as never)
    prismaMock.income.findMany.mockResolvedValue(toDelete as never)
    prismaMock.income.deleteMany.mockResolvedValue({ count: 2 } as never)

    const result = await IncomeService.deleteIncome(1, USER_ID)

    expect(prismaMock.income.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ user_id: USER_ID, tipo: 'Aluguel', fixo: true }),
      })
    )
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(2)
  })

  it('lança erro 404 quando receita não existe', async () => {
    prismaMock.income.findFirst.mockResolvedValue(null)

    await expect(IncomeService.deleteIncome(999, USER_ID)).rejects.toMatchObject({ status: 404 })
  })
})

describe('IncomeService.updateIncome', () => {
  it('atualiza campos da receita', async () => {
    const income = makeIncomeRecord()
    const updated = makeIncomeRecord({ tipo: 'Salário Novo', quantidade: 3500 })

    prismaMock.income.findFirst.mockResolvedValue(income as never)
    prismaMock.income.update.mockResolvedValue(updated as never)

    const result = await IncomeService.updateIncome(
      1,
      { tipo: 'Salário Novo', quantidade: 3500 },
      USER_ID
    )

    expect(prismaMock.income.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ tipo: 'Salário Novo', quantidade: 3500 }),
      })
    )
    expect((result as { tipo: string }).tipo).toBe('Salário Novo')
  })

  it('lança erro 404 quando receita não existe', async () => {
    prismaMock.income.findFirst.mockResolvedValue(null)

    await expect(
      IncomeService.updateIncome(999, { tipo: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('atualiza mesmo com dados vazios (comportamento do service)', async () => {
    // IncomeService.updateIncome sempre chama prisma.income.update,
    // ao contrário do ExpenseService que verifica se há campos
    const income = makeIncomeRecord()
    prismaMock.income.findFirst.mockResolvedValue(income as never)
    prismaMock.income.update.mockResolvedValue(income as never)

    const result = await IncomeService.updateIncome(1, {}, USER_ID)

    expect(prismaMock.income.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 }, data: {} })
    )
    expect((result as { id: number }).id).toBe(1)
  })
})
