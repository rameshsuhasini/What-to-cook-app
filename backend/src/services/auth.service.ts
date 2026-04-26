// ─────────────────────────────────────────
// Auth Service
//
// All business logic lives here:
// - Password hashing and comparison
// - JWT generation and verification
// - User creation flow
// - Login flow
//
// The service never touches req/res —
// that's the controller's job
// ─────────────────────────────────────────

import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import authRepository from '../repositories/auth.repository'
import { SignupDTO, LoginDTO, SafeUser, JwtPayload } from '../types/auth.types'

const SALT_ROUNDS = 12
const JWT_SECRET = process.env.JWT_SECRET!
const JWT_EXPIRES_IN = '7d'

export class AuthService {
  /**
   * Strip sensitive fields from user object
   * ALWAYS use this before sending user data
   * to the frontend
   */
  private sanitizeUser(user: SafeUser & { passwordHash?: string }): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    }
  }

  /**
   * Generate a signed JWT token
   */
  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email } as JwtPayload,
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    )
  }

  /**
   * SIGNUP
   * 1. Check if email already exists
   * 2. Hash password
   * 3. Create user + empty profile (in transaction)
   * 4. Generate JWT
   * 5. Return safe user + token
   */
  async signup(data: SignupDTO) {
    // Check if user already exists
    const existingUser = await authRepository.findByEmail(data.email)
    if (existingUser) {
      throw new Error('Email already registered')
    }

    // Validate password strength
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters')
    }

    // Hash password — never store plain text
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS)

    // Create user in DB
    const user = await authRepository.createUser({
      ...data,
      passwordHash,
    })

    // Generate JWT
    const token = this.generateToken(user.id, user.email)

    return {
      user: this.sanitizeUser(user),
      token,
    }
  }

  /**
   * LOGIN
   * 1. Find user by email
   * 2. Compare password with hash
   * 3. Update last login timestamp
   * 4. Generate JWT
   * 5. Return safe user + token
   */
  async login(data: LoginDTO) {
    // Find user
    const user = await authRepository.findByEmail(data.email)
    if (!user) {
      // Use generic message — don't reveal if email exists
      throw new Error('Invalid email or password')
    }

    // Compare password
    const isPasswordValid = await bcrypt.compare(data.password, user.passwordHash)
    if (!isPasswordValid) {
      throw new Error('Invalid email or password')
    }

    // Update last login
    await authRepository.updateLastLogin(user.id)

    // Generate JWT
    const token = this.generateToken(user.id, user.email)

    return {
      user: this.sanitizeUser(user),
      token,
    }
  }

  /**
   * GET CURRENT USER
   * Verify token and return user data
   */
  async getMe(userId: string) {
    const user = await authRepository.findById(userId)
    if (!user) {
      throw new Error('User not found')
    }
    return this.sanitizeUser(user)
  }

  /**
   * Verify a JWT token
   * Used in auth middleware
   */
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload
    } catch {
      throw new Error('Invalid or expired token')
    }
  }
}

export default new AuthService()