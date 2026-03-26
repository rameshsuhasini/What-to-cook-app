// ─────────────────────────────────────────
// Optional Authenticate Middleware
//
// Unlike `authenticate`, this middleware
// does NOT reject unauthenticated requests.
// It attaches req.user if a valid token
// exists, otherwise continues silently.
//
// Used for routes that are public but show
// extra data (e.g. isSaved) when logged in.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import authService from '../services/auth.service'

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = req.cookies?.token

    if (token) {
      const decoded = authService.verifyToken(token)
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
      }
    }
  } catch {
    // Token invalid or expired — silently ignore
    // req.user remains undefined
  }

  next()
}
