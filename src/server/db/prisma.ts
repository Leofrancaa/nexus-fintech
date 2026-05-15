import { PrismaPg } from '@prisma/adapter-pg'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require('@prisma/client')

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> | undefined }

function createPrismaClient(): InstanceType<typeof PrismaClient> {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

const prisma: InstanceType<typeof PrismaClient> = globalForPrisma.prisma ?? createPrismaClient()
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
