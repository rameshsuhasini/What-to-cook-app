// ─────────────────────────────────────────
// Auth Middleware
//
// This runs BEFORE protected route handlers.
// It checks the JWT cookie and attaches the
// decoded user to req.user so controllers
// can access the current user easily.
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

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Get token from httpOnly cookie
    const token = req.cookies?.token

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