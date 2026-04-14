// ─────────────────────────────────────────
// Auth Controller
//
// Controllers ONLY handle:
// - Reading from req
// - Calling the service
// - Writing to res
//
// NO business logic here — ever.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import authService from '../services/auth.service'

// Cookie config — httpOnly prevents JS access
// SameSite=None + Secure required for cross-origin (Vercel → Render)
const isProd = process.env.NODE_ENV === 'production'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
  path: '/',
}

export class AuthController {
  /**
   * POST /api/auth/signup
   */
  async signup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password } = req.body
      const result = await authService.signup({ name, email, password })

      // Set JWT in httpOnly cookie
      res.cookie('token', result.token, COOKIE_OPTIONS)

      res.status(201).json({
        success: true,
        data: { user: result.user },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body
      const result = await authService.login({ email, password })

      // Set JWT in httpOnly cookie
      res.cookie('token', result.token, COOKIE_OPTIONS)

      res.status(200).json({
        success: true,
        data: { user: result.user },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Clear the cookie by setting maxAge to 0
      res.clearCookie('token', { path: '/' })

      res.status(200).json({
        success: true,
        data: { message: 'Logged out successfully' },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/auth/me
   * Protected route — requires authenticate middleware
   */
  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.getMe(req.user!.userId)

      res.status(200).json({
        success: true,
        data: { user },
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new AuthController()