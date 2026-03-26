// ─────────────────────────────────────────
// Auth Types & DTOs
//
// DTOs (Data Transfer Objects) define the
// exact shape of data coming IN and going
// OUT of our API. This prevents accidentally
// exposing sensitive fields like passwordHash
// ─────────────────────────────────────────

export interface SignupDTO {
  name: string
  email: string
  password: string
}

export interface LoginDTO {
  email: string
  password: string
}

export interface AuthResponse {
  user: SafeUser
  token: string
}

// SafeUser — never includes passwordHash
export interface SafeUser {
  id: string
  name: string
  email: string
  createdAt: Date
  lastLogin: Date | null
}

export interface JwtPayload {
  userId: string
  email: string
  iat?: number
  exp?: number
}