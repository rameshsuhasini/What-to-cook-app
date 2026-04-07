// ─────────────────────────────────────────
// Profile Repository
// All DB operations for user profiles
// ─────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { UpdateProfileDTO } from '../types/profile.types'

export class ProfileRepository {
  async findByUserId(userId: string) {
    return prisma.userProfile.findUnique({
      where: { userId },
    })
  }

  async upsert(userId: string, data: UpdateProfileDTO) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    })
  }
}

export default new ProfileRepository()
