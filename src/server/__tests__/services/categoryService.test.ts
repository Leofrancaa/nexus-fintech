import { describe, it, expect } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../mocks/db'
import * as schema from '@/server/db/schema'
import { CategoryService } from '@/server/services/categoryService'

const USER_ID = 1

async function seedCategory(overrides: Partial<typeof schema.categories.$inferInsert> = {}) {
  const [row] = await db
    .insert(schema.categories)
    .values({
      nome: 'Alimentação',
      cor: '#FF6B6B',
      tipo: 'despesa',
      parent_id: null,
      user_id: USER_ID,
      ...overrides,
    })
    .returning()
  return row
}

// ─── createCategory ──────────────────────────────────────────────────────────

describe('CategoryService.createCategory', () => {
  it('cria categoria de despesa com sucesso', async () => {
    const result = await CategoryService.createCategory(
      { nome: 'Alimentação', cor: '#FF6B6B', tipo: 'despesa' },
      USER_ID
    )

    expect(result.nome).toBe('Alimentação')
    const rows = await db.select().from(schema.categories).where(eq(schema.categories.user_id, USER_ID))
    expect(rows).toHaveLength(1)
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
    await seedCategory({ nome: 'Alimentação', tipo: 'despesa' })

    await expect(
      CategoryService.createCategory({ nome: 'Alimentação', cor: '#00FF00', tipo: 'despesa' }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })

  it('lança erro 409 quando cor já está em uso no mesmo tipo', async () => {
    await seedCategory({ nome: 'Outra', cor: '#FF6B6B', tipo: 'despesa' })

    await expect(
      CategoryService.createCategory({ nome: 'Nova', cor: '#FF6B6B', tipo: 'despesa' }, USER_ID)
    ).rejects.toMatchObject({ status: 409, message: expect.stringContaining('cor') })
  })

  it('lança erro 400 quando parent é de tipo diferente', async () => {
    const parent = await seedCategory({ nome: 'Pai', cor: '#111111', tipo: 'receita' })

    await expect(
      CategoryService.createCategory(
        { nome: 'Sub', cor: '#222222', tipo: 'despesa', parent_id: parent.id },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('mesmo tipo') })
  })

  it('lança erro 404 quando parent_id não existe', async () => {
    await expect(
      CategoryService.createCategory(
        { nome: 'Sub', cor: '#222222', tipo: 'despesa', parent_id: 999 },
        USER_ID
      )
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── updateCategory ───────────────────────────────────────────────────────────

describe('CategoryService.updateCategory', () => {
  it('atualiza nome com sucesso', async () => {
    const cat = await seedCategory()

    const result = await CategoryService.updateCategory(cat.id, { nome: 'Comida' }, USER_ID)

    expect(result.nome).toBe('Comida')
  })

  it('lança erro 404 quando categoria não existe', async () => {
    await expect(
      CategoryService.updateCategory(999, { nome: 'X' }, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })

  it('lança erro 400 quando categoria tenta ser pai de si mesma', async () => {
    const cat = await seedCategory()

    await expect(
      CategoryService.updateCategory(cat.id, { parent_id: cat.id }, USER_ID)
    ).rejects.toMatchObject({ status: 400, message: expect.stringContaining('pai de si mesma') })
  })

  it('lança erro 409 quando novo nome já existe', async () => {
    const cat = await seedCategory({ nome: 'Alimentação' })
    await seedCategory({ nome: 'Comida', cor: '#00FF00' })

    await expect(
      CategoryService.updateCategory(cat.id, { nome: 'Comida' }, USER_ID)
    ).rejects.toMatchObject({ status: 409 })
  })
})

// ─── deleteCategory ───────────────────────────────────────────────────────────

describe('CategoryService.deleteCategory', () => {
  it('deleta categoria simples sem subcategorias e sem transações', async () => {
    const cat = await seedCategory()

    const result = await CategoryService.deleteCategory(cat.id, USER_ID)

    expect(result.deletedItems.subcategorias).toBe(0)
    expect(result.deletedItems.despesas).toBe(0)
    const rows = await db.select().from(schema.categories).where(eq(schema.categories.id, cat.id))
    expect(rows).toHaveLength(0)
  })

  it('deleta categoria com subcategorias e transações em cascata', async () => {
    const parent = await seedCategory({ nome: 'Pai' })
    const child = await seedCategory({ nome: 'Sub', cor: '#00FF00', parent_id: parent.id })

    await db.insert(schema.expenses).values([
      { metodo_pagamento: 'pix', tipo: 'compra', quantidade: '10', data: new Date('2025-01-01'), user_id: USER_ID, category_id: parent.id },
      { metodo_pagamento: 'pix', tipo: 'compra', quantidade: '20', data: new Date('2025-01-02'), user_id: USER_ID, category_id: child.id },
      { metodo_pagamento: 'pix', tipo: 'compra', quantidade: '30', data: new Date('2025-01-03'), user_id: USER_ID, category_id: parent.id },
    ])
    await db.insert(schema.incomes).values([
      { tipo: 'venda', quantidade: '5', data: new Date('2025-01-01'), user_id: USER_ID, category_id: child.id },
    ])

    const result = await CategoryService.deleteCategory(parent.id, USER_ID)

    expect(result.deletedItems.subcategorias).toBe(1)
    expect(result.deletedItems.despesas).toBe(3)
    expect(result.deletedItems.receitas).toBe(1)

    const cats = await db.select().from(schema.categories).where(eq(schema.categories.user_id, USER_ID))
    expect(cats).toHaveLength(0)
  })

  it('lança erro 404 quando categoria não existe', async () => {
    await expect(
      CategoryService.deleteCategory(999, USER_ID)
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ─── getCategoryTree ──────────────────────────────────────────────────────────

describe('CategoryService.getCategoryTree', () => {
  it('retorna estrutura hierárquica com pai e filhos', async () => {
    const parent = await seedCategory({ nome: 'Pai', parent_id: null })
    await seedCategory({ nome: 'Sub', cor: '#00FF00', parent_id: parent.id })

    const result = await CategoryService.getCategoryTree(USER_ID)

    expect(result.length).toBe(1)
    expect(result[0].children?.length).toBe(1)
    expect(result[0].children?.[0].nome).toBe('Sub')
  })

  it('retorna lista vazia quando não há categorias', async () => {
    const result = await CategoryService.getCategoryTree(USER_ID)

    expect(result).toEqual([])
  })
})
