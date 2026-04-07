// ─────────────────────────────────────────
// Profile Service
// ─────────────────────────────────────────

import path from 'path'
import fs from 'fs'
import profileRepository from '../repositories/profile.repository'
import { UpdateProfileDTO } from '../types/profile.types'

export class ProfileService {
  async getProfile(userId: string) {
    const profile = await profileRepository.findByUserId(userId)
    if (!profile) {
      throw new Error('Profile not found')
    }
    return profile
  }

  async updateProfile(userId: string, data: UpdateProfileDTO) {
    return profileRepository.upsert(userId, data)
  }

  async updateAvatar(userId: string, filename: string) {
    // Delete old avatar file if it exists
    const existing = await profileRepository.findByUserId(userId)
    if (existing?.avatarUrl) {
      const oldPath = path.join(process.cwd(), 'uploads', 'avatars', path.basename(existing.avatarUrl))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    const avatarUrl = `/uploads/avatars/${filename}`
    return profileRepository.upsert(userId, { avatarUrl })
  }
}

export default new ProfileService()
