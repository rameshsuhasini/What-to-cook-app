// ─────────────────────────────────────────
// Auth Store — Zustand
//
// Client-side auth state management.
// Server state (me endpoint) handled
// by React Query in the providers.
// ─────────────────────────────────────────

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AuthUser } from '@/services/auth.service'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  setUser: (user: AuthUser | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),

      logout: () =>
        set({ user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-store',
      // Only persist non-sensitive fields
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
