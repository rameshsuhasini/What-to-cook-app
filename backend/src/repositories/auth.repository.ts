// ─────────────────────────────────────────
// Auth Repository
//
// Why a repository? All DB queries live here.
// If we ever switch from Prisma to something
// else, we only change this file — nothing
// else in the app needs to change.
// ─────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { SignupDTO } from '../types/auth.types'

export class AuthRepository {
  /**
   * Find a user by their email address
   * Used during login to check credentials
   */
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { profile: true },
    })
  }

  /**
   * Find a user by their ID
   * Used to validate JWT tokens
   */
  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    })
  }

  /**
   * Create a new user with an empty profile
   * We create both in a transaction so either
   * both succeed or both fail — no orphaned users
   */
  async createUser(data: SignupDTO & { passwordHash: string }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name.trim(),
          email: data.email.toLowerCase().trim(),
          passwordHash: data.passwordHash,
          // Create empty profile immediately
          profile: {
            create: {},
          },
        },
        include: { profile: true },
      })
      return user
    })
  }

  /**
   * Update last login timestamp
   * Called every time user successfully logs in
   */
  async updateLastLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    })
  }
}

export default new AuthRepository()