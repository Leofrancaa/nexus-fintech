import { PrismaClient } from '@prisma/client'
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended'
import { vi } from 'vitest'

// Instância única do mock — compartilhada entre todos os testes via setup
export const prismaMock = mockDeep<PrismaClient>()

// Substitui o módulo real pelo mock em todos os testes
vi.mock('@/server/db/prisma', () => ({
  default: prismaMock,
}))

export type PrismaMock = DeepMockProxy<PrismaClient>
