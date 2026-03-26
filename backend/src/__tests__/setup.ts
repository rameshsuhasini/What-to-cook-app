// ─────────────────────────────────────────
// Test Setup
// Runs before every test file
// Sets up environment variables for testing
// ─────────────────────────────────────────

import { vi } from 'vitest'

// Set test environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.NODE_ENV = 'test'