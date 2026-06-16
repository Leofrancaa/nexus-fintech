import { beforeAll, beforeEach } from 'vitest'
import { applySchema, resetDb } from './mocks/db'

// Cria o schema uma vez antes de toda a suíte.
beforeAll(async () => {
  await applySchema()
})

// Limpa os dados antes de cada teste para garantir isolamento.
beforeEach(async () => {
  await resetDb()
})
