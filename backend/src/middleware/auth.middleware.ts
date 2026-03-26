// ─────────────────────────────────────────
// Auth Middleware
//
// Checks JWT from two sources (in order):
// 1. httpOnly cookie (production / frontend)
// 2. Authorization: Bearer <token> header
//    (development / API testing tools)
//
// This dual approach lets us use httpOnly
// cookies securely in production while still
// being able to test with Postman/Thunder Client.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import authService from '../services/auth.service'

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        email: string
      }
    }
  }
}

/**
 * Extract token from request
 * Checks cookie first, then Authorization header
 */
const extractToken = (req: Request): string | null => {
  // 1. Check httpOnly cookie (preferred — used by frontend)
  if (req.cookies?.token) {
    return req.cookies.token
  }

  // 2. Check Authorization: Bearer <token> header (for API testing)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req)

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      })
      return
    }

    // Verify token and attach user to request
    const decoded = authService.verifyToken(token)
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
    }

    next()
  } catch {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    })
  }
}

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req)

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