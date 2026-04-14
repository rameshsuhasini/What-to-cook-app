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
  token: string | null
  isAuthenticated: boolean
  setUser: (user: AuthUser | null, token?: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user, token) =>
        set({ user, token: token ?? null, isAuthenticated: !!user }),

      logout: () =>
        set({ user: null, token: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
