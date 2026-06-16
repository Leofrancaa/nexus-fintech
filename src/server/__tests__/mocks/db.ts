import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { vi } from 'vitest'
import * as schema from '@/server/db/schema'

// Postgres efêmero em memória (WASM). Compartilhado por todos os testes.
const client = new PGlite()
export const db = drizzle(client, { schema })

// Substitui o client real do Drizzle pelo PGlite em todos os testes.
vi.mock('@/server/db/drizzle', () => ({
  default: db,
  schema,
}))

// Selic determinística nos testes (evita chamadas de rede ao BCB).
vi.mock('@/server/services/selicService', () => ({
  getSelicAnual: vi.fn(async () => ({ valor: 10, fonte: 'bcb' as const, atualizadoEm: 0 })),
}))

const TABLES = [
  'plan_contributions',
  'plans',
  'thresholds',
  'card_invoices_payments',
  'expenses',
  'incomes',
  'goals',
  'cards',
  'categories',
  'invite_codes',
  'expense_history',
  'career_profile',
  'career_milestones',
  'study_items',
  'personal_goals',
  'imported_transactions',
  'import_batches',
  'chat_messages',
  'users',
]

// Aplica todas as migrações geradas pelo drizzle-kit (em ordem) + tabela auxiliar expense_history.
export async function applySchema(): Promise<void> {
  const drizzleDir = path.join(process.cwd(), 'drizzle')
  const files = readdirSync(drizzleDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const ddl = readFileSync(path.join(drizzleDir, file), 'utf-8').replace(
      /-->\s*statement-breakpoint/g,
      ''
    )
    await client.exec(ddl)
  }

  await client.exec(`
    CREATE TABLE IF NOT EXISTS expense_history (
      id serial PRIMARY KEY,
      expense_id integer NOT NULL,
      user_id integer NOT NULL,
      tipo text NOT NULL,
      alteracao jsonb,
      created_at timestamp DEFAULT now() NOT NULL
    );
  `)
}

// Limpa todas as tabelas e reinicia as sequences entre os testes.
export async function resetDb(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE;`))
}

export { schema, client }
