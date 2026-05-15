import { beforeEach } from 'vitest'
import { mockReset } from 'vitest-mock-extended'
import { prismaMock } from './mocks/prisma'

beforeEach(() => {
  mockReset(prismaMock)
})
