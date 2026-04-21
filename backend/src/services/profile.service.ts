// ─────────────────────────────────────────
// Profile Service
// ─────────────────────────────────────────

import { v2 as cloudinary } from 'cloudinary'
import profileRepository from '../repositories/profile.repository'
import { UpdateProfileDTO } from '../types/profile.types'

// Cloudinary is configured once from env vars.
// Required: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

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
   * Upload avatar buffer to Cloudinary and save the CDN URL to DB.
   * Overwrites the previous image using a stable public_id so the old
   * URL is automatically invalidated — no orphaned files.
   */
  async updateAvatar(
    userId: string,
    buffer: Buffer,
    mimetype: string,
    _originalname: string
  ) {
    // Wrap the buffer in a data URI for the Cloudinary upload stream
    const base64 = buffer.toString('base64')
    const dataUri = `data:${mimetype};base64,${base64}`

    // Use a stable public_id per user so each upload overwrites the last
    const publicId = `what-to-cook/avatars/${userId}`

    const result = await cloudinary.uploader.upload(dataUri, {
      public_id:     publicId,
      overwrite:     true,
      resource_type: 'image',
      transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
    })

    return profileRepository.upsert(userId, { avatarUrl: result.secure_url })
  }
}

export default new ProfileService()
