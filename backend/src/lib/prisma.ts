// ─────────────────────────────────────────
// Prisma Client Singleton — Prisma 7
//
// Prisma 7 requires an explicit database
// adapter instead of a connection URL in
// schema.prisma. We use @prisma/adapter-pg
// which wraps the pg (node-postgres) driver.
//
// Why singleton? Prevents multiple client
// instances during hot reloading in dev
// which would exhaust the connection pool.
// ─────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error('❌ DATABASE_URL is not defined in environment variables')
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ 
    connectionString: process.env.DATABASE_URL as string,
  })
  
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma