// ─────────────────────────────────────────
// Auth API Service
//
// All auth-related API calls go here.
// Uses axios with credentials for cookies.
// ─────────────────────────────────────────

import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,  // sends httpOnly cookies
  headers: { 'Content-Type': 'application/json' },
})

export interface SignupPayload {
  name: string
  email: string
  password: string
}

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthUser {
  id: string
  name: string
  email: string
  createdAt: string
  lastLogin: string | null
  profile?: {
    calorieGoal: number | null
    proteinGoal: number | null
    carbGoal: number | null
    fatGoal: number | null
    dietType: string | null
    allergies: string | null
  }
}

export const authApi = {
  signup: async (payload: SignupPayload): Promise<{ user: AuthUser; token: string }> => {
    const res = await api.post('/api/auth/signup', payload)
    return { user: res.data.data.user, token: res.data.data.token }
  },

  login: async (payload: LoginPayload): Promise<{ user: AuthUser; token: string }> => {
    const res = await api.post('/api/auth/login', payload)
    return { user: res.data.data.user, token: res.data.data.token }
  },

  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout')
  },

  getMe: async (): Promise<AuthUser> => {
    const res = await api.get('/api/auth/me')
    return res.data.data.user
  },
}
