import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined
  db: ReturnType<typeof drizzle<typeof schema>> | undefined
}

function createPool(): Pool {
  return new Pool({ connectionString: process.env.DATABASE_URL })
}

const pool: Pool = globalForDb.pool ?? createPool()

const db = globalForDb.db ?? drizzle(pool, { schema })

if (process.env.NODE_ENV !== 'production') {
  globalForDb.pool = pool
  globalForDb.db = db
}

export { schema }
export default db
