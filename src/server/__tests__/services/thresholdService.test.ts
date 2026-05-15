import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { ThresholdService } from '@/server/services/thresholdService'

const USER_ID = 1

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    nome: 'Alimentação',
    cor: '#FF6B6B',
    tipo: 'despesa',
    parent_id: null,
    user_id: USER_ID,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

function makeThreshold(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    user_id: USER_ID,
    category_id: 1,
    valor: 500,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()
})

// ─── createOrUpdateThreshold ─────────────────────────────────────────────────

describe('ThresholdService.createOrUpdateThreshold', () => {
  it('cria threshold com sucesso (upsert)', async () => {
    prismaMock.category.findFirst.mockResolvedValue(makeCategory() as never)
    prismaMock.threshold.upsert.mockResolvedValue(makeThreshold() as never)

    const result = await ThresholdService.createOrUpdateThreshold(
      { category_id: 1, valor: 500 },
      USER_ID
    )

    expect(prismaMock.threshold.upsert).toHaveBeenCalledOnce()
    expect(result.valor).toBe(500)
  })

  it('lança erro 400 quando valor é zero ou negativo', async () => {
    await expect(
      ThresholdService.createOrUpdateThreshold({ category_id: 1, valor: 0 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 404 quando categoria não existe', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null)

    await expect(
      ThresholdService.createOrUpdateThreshold({ category_id: 999, valor: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando categoria é do tipo receita', async () => {
    prismaMock.category.findFirst.mockResolvedValue(makeCategory({ tipo: 'receita' }) as never)

    await expect(
      ThresholdService.createOrUpdateThreshold({ category_id: 1, valor: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('despesa') })
  })

  it('atualiza threshold existente (upsert com update)', async () => {
    prismaMock.category.findFirst.mockResolvedValue(makeCategory() as never)
    prismaMock.threshold.upsert.mockResolvedValue(makeThreshold({ valor: 800 }) as never)

    const result = await ThresholdService.createOrUpdateThreshold(
      { category_id: 1, valor: 800 },
      USER_ID
    )

    expect(result.valor).toBe(800)
    const upsertCall = prismaMock.threshold.upsert.mock.calls[0][0] as { update: Record<string, unknown> }
    expect(upsertCall.update.valor).toBe(800)
  })
})

// ─── updateThreshold ──────────────────────────────────────────────────────────

describe('ThresholdService.updateThreshold', () => {
  it('atualiza valor com sucesso', async () => {
    const existing = makeThreshold()
    const updated = makeThreshold({ valor: 700 })
    prismaMock.threshold.findFirst.mockResolvedValue(existing as never)
    prismaMock.threshold.update.mockResolvedValue(updated as never)

    const result = await ThresholdService.updateThreshold(1, { valor: 700 }, USER_ID)

    expect(result.valor).toBe(700)
  })

  it('lança erro 404 quando threshold não existe', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(null)

    await expect(
      ThresholdService.updateThreshold(999, { valor: 500 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando novo valor é negativo', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(makeThreshold() as never)

    await expect(
      ThresholdService.updateThreshold(1, { valor: -100 }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })
})

// ─── deleteThreshold ──────────────────────────────────────────────────────────

describe('ThresholdService.deleteThreshold', () => {
  it('deleta threshold com sucesso', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(makeThreshold() as never)
    prismaMock.threshold.delete.mockResolvedValue({} as never)

    const result = await ThresholdService.deleteThreshold(1, USER_ID)

    expect(prismaMock.threshold.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(result.message).toContain('sucesso')
  })

  it('lança erro 404 quando threshold não existe', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(null)

    await expect(
      ThresholdService.deleteThreshold(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── checkThresholdViolation ──────────────────────────────────────────────────

describe('ThresholdService.checkThresholdViolation', () => {
  it('retorna would_violate=false quando não há threshold configurado', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(null)

    const result = await ThresholdService.checkThresholdViolation(USER_ID, 1, 100)

    expect(result.would_violate).toBe(false)
  })

  it('retorna would_violate=false quando gasto + valor fica dentro do limite', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(makeThreshold({ valor: 500 }) as never)
    prismaMock.$queryRaw.mockResolvedValue([{ current_spending: '200' }] as never)

    const result = await ThresholdService.checkThresholdViolation(USER_ID, 1, 100, 1, 2025)

    // 200 + 100 = 300 < 500 → não viola
    expect(result.would_violate).toBe(false)
    expect(result.remaining).toBe(300)
    expect(result.new_total).toBe(300)
  })

  it('retorna would_violate=true quando gasto + valor ultrapassa o limite', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(makeThreshold({ valor: 500 }) as never)
    prismaMock.$queryRaw.mockResolvedValue([{ current_spending: '450' }] as never)

    const result = await ThresholdService.checkThresholdViolation(USER_ID, 1, 100, 1, 2025)

    // 450 + 100 = 550 > 500 → viola
    expect(result.would_violate).toBe(true)
    expect(result.new_total).toBe(550)
    expect(result.threshold_value).toBe(500)
  })

  it('retorna would_violate=true quando já está acima do limite (só verificar)', async () => {
    prismaMock.threshold.findFirst.mockResolvedValue(makeThreshold({ valor: 300 }) as never)
    prismaMock.$queryRaw.mockResolvedValue([{ current_spending: '400' }] as never)

    // Mesmo com valor 0, já está acima
    const result = await ThresholdService.checkThresholdViolation(USER_ID, 1, 1, 1, 2025)

    expect(result.would_violate).toBe(true)
  })
})
