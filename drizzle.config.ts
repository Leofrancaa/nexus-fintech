import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/server/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // Banco de produção já existe; mantemos verbose/strict para evitar mudanças destrutivas.
  verbose: true,
  strict: true,
})
