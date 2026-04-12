// ─────────────────────────────────────────
// Profile Service
// ─────────────────────────────────────────

import { put, del } from '@vercel/blob'
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

  /**
   * Upload avatar buffer to Vercel Blob and save the CDN URL to DB.
   * Deletes the previous blob if one existed so storage stays clean.
   */
  async updateAvatar(
    userId: string,
    buffer: Buffer,
    mimetype: string,
    originalname: string
  ) {
    const existing = await profileRepository.findByUserId(userId)

    // Upload new file to Vercel Blob
    const ext = originalname.split('.').pop() ?? 'jpg'
    const filename = `avatars/${userId}-${Date.now()}.${ext}`

    const { url } = await put(filename, buffer, {
      access: 'public',
      contentType: mimetype,
    })

    // Persist the CDN URL in the DB
    const profile = await profileRepository.upsert(userId, { avatarUrl: url })

    // Delete old blob after successful DB write so we don't orphan files
    if (existing?.avatarUrl && existing.avatarUrl.includes('vercel-storage.com')) {
      await del(existing.avatarUrl).catch(() => {
        // Non-fatal — old blob cleanup failure should not break the response
      })
    }

    return profile
  }
}

export default new ProfileService()
