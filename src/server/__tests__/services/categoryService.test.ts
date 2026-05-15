import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from '../mocks/prisma'
import { CategoryService } from '@/server/services/categoryService'

const USER_ID = 1

function makeCategoryRecord(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  mockReset(prismaMock)
  vi.clearAllMocks()

  prismaMock.$transaction.mockImplementation(async (ops: unknown) => {
    if (typeof ops === 'function') return ops(prismaMock)
    return Promise.all(ops as Promise<unknown>[])
  })
})

// ─── createCategory ──────────────────────────────────────────────────────────

describe('CategoryService.createCategory', () => {
  it('cria categoria de despesa com sucesso', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null) // sem duplicata nome
    // segunda chamada: verificação de cor
    prismaMock.category.findFirst.mockResolvedValue(null)
    const record = makeCategoryRecord()
    prismaMock.category.create.mockResolvedValue(record as never)

    const result = await CategoryService.createCategory(
      { nome: 'Alimentação', cor: '#FF6B6B', tipo: 'despesa' },
      USER_ID
    )

    expect(prismaMock.category.create).toHaveBeenCalledOnce()
    expect(result.nome).toBe('Alimentação')
  })

  it('lança erro 400 quando nome está ausente', async () => {
    await expect(
      CategoryService.createCategory({ nome: '', cor: '#FF6B6B', tipo: 'despesa' }, USER_ID)
    ).rejects.toMatchObject({ status: 400 })
  })

  it('lança erro 400 quando tipo é inválido', async () => {
    await expect(
      CategoryService.createCategory({ nome: 'Teste', cor: '#FF6B6B', tipo: 'outro' as never }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining("'despesa' ou 'receita'") })
  })

  it('lança erro 400 quando cor não é hexadecimal válida', async () => {
    await expect(
      CategoryService.createCategory({ nome: 'Teste', cor: 'vermelho', tipo: 'despesa' }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('hexadecimal') })
  })

  it('lança erro 409 quando nome já existe para o mesmo tipo', async () => {
    prismaMock.category.findFirst.mockResolvedValue(makeCategoryRecord() as never)

    await expect(
      CategoryService.createCategory({ nome: 'Alimentação', cor: '#FF6B6B', tipo: 'despesa' }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('lança erro 409 quando cor já está em uso no mesmo tipo', async () => {
    prismaMock.category.findFirst
      .mockResolvedValueOnce(null)  // nome não duplicado
      .mockResolvedValueOnce(makeCategoryRecord({ nome: 'Outra' }) as never) // cor duplicada

    await expect(
      CategoryService.createCategory({ nome: 'Nova', cor: '#FF6B6B', tipo: 'despesa' }, USER_ID)
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('cor') })
  })

  it('lança erro 400 quando parent é de tipo diferente', async () => {
    prismaMock.category.findFirst
      .mockResolvedValueOnce(null)  // nome não duplicado
      .mockResolvedValueOnce(null)  // cor não duplicada
      .mockResolvedValueOnce(makeCategoryRecord({ tipo: 'receita' }) as never) // parent de tipo diferente

    await expect(
      CategoryService.createCategory({ nome: 'Sub', cor: '#FF6B6B', tipo: 'despesa', parent_id: 99 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('mesmo tipo') })
  })

  it('lança erro 404 quando parent_id não existe', async () => {
    prismaMock.category.findFirst
      .mockResolvedValueOnce(null) // nome não duplicado
      .mockResolvedValueOnce(null) // cor não duplicada
      .mockResolvedValueOnce(null) // parent não encontrado

    await expect(
      CategoryService.createCategory({ nome: 'Sub', cor: '#FF6B6B', tipo: 'despesa', parent_id: 999 }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updateCategory ───────────────────────────────────────────────────────────

describe('CategoryService.updateCategory', () => {
  it('atualiza nome com sucesso', async () => {
    const existing = makeCategoryRecord()
    const updated = makeCategoryRecord({ nome: 'Comida' })
    prismaMock.category.findFirst
      .mockResolvedValueOnce(existing as never)  // getCategoryById
      .mockResolvedValueOnce(null)               // sem nome duplicado
    prismaMock.category.update.mockResolvedValue(updated as never)

    const result = await CategoryService.updateCategory(1, { nome: 'Comida' }, USER_ID)

    expect(prismaMock.category.update).toHaveBeenCalledOnce()
    expect(result.nome).toBe('Comida')
  })

  it('lança erro 404 quando categoria não existe', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null)

    await expect(
      CategoryService.updateCategory(999, { nome: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando categoria tenta ser pai de si mesma', async () => {
    prismaMock.category.findFirst.mockResolvedValue(makeCategoryRecord() as never)

    await expect(
      CategoryService.updateCategory(1, { parent_id: 1 }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('pai de si mesma') })
  })

  it('lança erro 409 quando novo nome já existe', async () => {
    prismaMock.category.findFirst
      .mockResolvedValueOnce(makeCategoryRecord() as never)  // exists
      .mockResolvedValueOnce(makeCategoryRecord({ id: 2, nome: 'Comida' }) as never) // duplicado

    await expect(
      CategoryService.updateCategory(1, { nome: 'Comida' }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })
})

// ─── deleteCategory ───────────────────────────────────────────────────────────

describe('CategoryService.deleteCategory', () => {
  it('deleta categoria simples sem subcategorias e sem transações', async () => {
    prismaMock.category.findFirst.mockResolvedValue(makeCategoryRecord() as never)
    prismaMock.category.findMany.mockResolvedValue([] as never) // sem subcategorias
    prismaMock.expense.count.mockResolvedValue(0)
    prismaMock.income.count.mockResolvedValue(0)
    prismaMock.expense.deleteMany.mockResolvedValue({ count: 0 } as never)
    prismaMock.income.deleteMany.mockResolvedValue({ count: 0 } as never)
    prismaMock.threshold.deleteMany.mockResolvedValue({ count: 0 } as never)
    prismaMock.category.delete.mockResolvedValue({} as never)

    const result = await CategoryService.deleteCategory(1, USER_ID)

    expect(prismaMock.category.delete).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(result.deletedItems.subcategorias).toBe(0)
    expect(result.deletedItems.despesas).toBe(0)
  })

  it('deleta categoria com subcategorias em cascata', async () => {
    const parent = makeCategoryRecord()
    const child = makeCategoryRecord({ id: 2, parent_id: 1, nome: 'Sub' })

    prismaMock.category.findFirst.mockResolvedValue(parent as never)
    // getAllSubcategoryIds: 1ª chamada retorna [child], 2ª (recursiva) retorna []
    prismaMock.category.findMany
      .mockResolvedValueOnce([child] as never)
      .mockResolvedValueOnce([] as never)
    prismaMock.expense.count.mockResolvedValue(3)
    prismaMock.income.count.mockResolvedValue(1)
    prismaMock.expense.deleteMany.mockResolvedValue({ count: 3 } as never)
    prismaMock.income.deleteMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.threshold.deleteMany.mockResolvedValue({ count: 0 } as never)
    prismaMock.category.deleteMany.mockResolvedValue({ count: 1 } as never)
    prismaMock.category.delete.mockResolvedValue({} as never)

    const result = await CategoryService.deleteCategory(1, USER_ID)

    expect(result.deletedItems.subcategorias).toBe(1)
    expect(result.deletedItems.despesas).toBe(3)
    expect(result.deletedItems.receitas).toBe(1)
    expect(prismaMock.category.deleteMany).toHaveBeenCalledOnce() // deletou subcategorias
  })

  it('lança erro 404 quando categoria não existe', async () => {
    prismaMock.category.findFirst.mockResolvedValue(null)

    await expect(
      CategoryService.deleteCategory(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── getCategoryTree ──────────────────────────────────────────────────────────

describe('CategoryService.getCategoryTree', () => {
  it('retorna estrutura hierárquica com pai e filhos', async () => {
    const parent = makeCategoryRecord({ id: 1, parent_id: null })
    const child = makeCategoryRecord({ id: 2, parent_id: 1, nome: 'Sub' })

    prismaMock.category.findMany.mockResolvedValue([parent, child] as never)

    const result = await CategoryService.getCategoryTree(USER_ID)

    expect(result.length).toBe(1) // apenas 1 raiz
    expect(result[0].children?.length).toBe(1)
    expect(result[0].children?.[0].nome).toBe('Sub')
  })

  it('retorna lista vazia quando não há categorias', async () => {
    prismaMock.category.findMany.mockResolvedValue([] as never)

    const result = await CategoryService.getCategoryTree(USER_ID)

    expect(result).toEqual([])
  })
})
