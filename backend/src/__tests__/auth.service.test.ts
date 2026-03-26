// ─────────────────────────────────────────
// Auth Service Unit Tests
// Using Vitest (Jest-compatible API)
// ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthService } from '../services/auth.service'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────
// Mock the repository and prisma
// so tests never hit the real database
// ─────────────────────────────────────────

vi.mock('../repositories/auth.repository', () => ({
  default: {
    findByEmail: vi.fn(),
    createUser: vi.fn(),
    updateLastLogin: vi.fn(),
    findById: vi.fn(),
  },
}))

vi.mock('../lib/prisma', () => ({
  default: {},
  prisma: {},
}))

// Import AFTER mocking
import authRepository from '../repositories/auth.repository'

const authService = new AuthService()

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Signup Tests ──────────────────────
  describe('signup', () => {
    it('should create a new user successfully', async () => {
      const mockUser = {
        id: 'cuid123',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: 'hashedpassword',
        createdAt: new Date(),
        lastLogin: null,
        updatedAt: new Date(),
      }

      vi.mocked(authRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(authRepository.createUser).mockResolvedValue(mockUser as any)

      const result = await authService.signup({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123',
      })

      expect(result.user.email).toBe('john@example.com')
      expect(result.token).toBeDefined()
      // Critical security check — never expose passwordHash
      expect(result.user).not.toHaveProperty('passwordHash')
    })

    it('should throw if email already exists', async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue({
        id: 'existing',
        email: 'john@example.com',
      } as any)

      await expect(
        authService.signup({
          name: 'John',
          email: 'john@example.com',
          password: 'Password123',
        })
      ).rejects.toThrow('Email already registered')
    })

    it('should throw if password is too short', async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue(null)

      await expect(
        authService.signup({
          name: 'John',
          email: 'john@example.com',
          password: 'short',
        })
      ).rejects.toThrow('Password must be at least 8 characters')
    })

    it('should never store plain text password', async () => {
      const mockUser = {
        id: 'cuid123',
        name: 'John',
        email: 'john@example.com',
        passwordHash: 'hashedvalue',
        createdAt: new Date(),
        lastLogin: null,
        updatedAt: new Date(),
      }

      vi.mocked(authRepository.findByEmail).mockResolvedValue(null)
      vi.mocked(authRepository.createUser).mockResolvedValue(mockUser as any)

      const createSpy = vi.mocked(authRepository.createUser)
      await authService.signup({
        name: 'John',
        email: 'john@example.com',
        password: 'Password123',
      })

      // The password saved to DB must NOT be the plain text
      const savedData = createSpy.mock.calls[0][0]
      expect(savedData.passwordHash).not.toBe('Password123')
    })
  })

  // ── Login Tests ───────────────────────
  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12)
      const mockUser = {
        id: 'cuid123',
        name: 'John Doe',
        email: 'john@example.com',
        passwordHash: hashedPassword,
        createdAt: new Date(),
        lastLogin: null,
        updatedAt: new Date(),
      }

      vi.mocked(authRepository.findByEmail).mockResolvedValue(mockUser as any)
      vi.mocked(authRepository.updateLastLogin).mockResolvedValue(mockUser as any)

      const result = await authService.login({
        email: 'john@example.com',
        password: 'Password123',
      })

      expect(result.user.email).toBe('john@example.com')
      expect(result.token).toBeDefined()
      expect(result.user).not.toHaveProperty('passwordHash')
    })

    it('should throw with wrong password', async () => {
      const hashedPassword = await bcrypt.hash('Password123', 12)
      vi.mocked(authRepository.findByEmail).mockResolvedValue({
        id: 'cuid123',
        email: 'john@example.com',
        passwordHash: hashedPassword,
      } as any)

      await expect(
        authService.login({
          email: 'john@example.com',
          password: 'WrongPassword123',
        })
      ).rejects.toThrow('Invalid email or password')
    })

    it('should throw with non-existent email', async () => {
      vi.mocked(authRepository.findByEmail).mockResolvedValue(null)

      await expect(
        authService.login({
          email: 'nobody@example.com',
          password: 'Password123',
        })
      ).rejects.toThrow('Invalid email or password')
    })

    it('should use same error message for wrong email and wrong password', async () => {
      // Security: Don't reveal whether email exists
      vi.mocked(authRepository.findByEmail).mockResolvedValue(null)

      const error1 = await authService
        .login({ email: 'nobody@example.com', password: 'Password123' })
        .catch((e) => e.message)

      const hashedPassword = await bcrypt.hash('Password123', 12)
      vi.mocked(authRepository.findByEmail).mockResolvedValue({
        id: '123',
        email: 'john@example.com',
        passwordHash: hashedPassword,
      } as any)

      const error2 = await authService
        .login({ email: 'john@example.com', password: 'WrongPass123' })
        .catch((e) => e.message)

      // Both errors must be identical — no user enumeration
      expect(error1).toBe(error2)
    })
  })
})