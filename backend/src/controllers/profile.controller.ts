// ─────────────────────────────────────────
// Profile Controller
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import profileService from '../services/profile.service'

export class ProfileController {
  /**
   * GET /api/profile
   */
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await profileService.getProfile(req.user!.userId)
      res.status(200).json({ success: true, data: { profile } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/profile
   */
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await profileService.updateProfile(req.user!.userId, req.body)
      res.status(200).json({ success: true, data: { profile } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/profile/avatar
   */
  async uploadAvatar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const file = (req as any).file
      if (!file) {
        res.status(400).json({ success: false, message: 'No file uploaded' })
        return
      }
      const profile = await profileService.updateAvatar(
        req.user!.userId,
        file.buffer,
        file.mimetype,
        file.originalname
      )
      res.status(200).json({ success: true, data: { profile } })
    } catch (error) {
      next(error)
    }
  }
}

export default new ProfileController()
