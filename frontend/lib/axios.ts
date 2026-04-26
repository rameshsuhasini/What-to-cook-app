import axios from 'axios'
import { useNetworkStore } from '@/store/network.store'

const api = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // Default 30s — overridden per-request for AI endpoints below
  timeout: 30_000,
})

// Attach Bearer token from Zustand store on every request
// This handles cross-origin (Vercel → Render) where cookies are blocked
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('auth-store')
      if (raw) {
        const parsed = JSON.parse(raw)
        const token = parsed?.state?.token
        if (token) {
          config.headers['Authorization'] = `Bearer ${token}`
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  return config
})

// Clear auth on 401 and track server reachability
api.interceptors.response.use(
  (response) => {
    if (typeof window !== 'undefined') {
      useNetworkStore.getState().setServerReachable(true)
    }
    return response
  },
  (error: unknown) => {
    if (typeof window !== 'undefined') {
      const axiosError = error as { response?: { status?: number } }
      if (!axiosError.response) {
        // No response — server is down, offline, or request timed out
        useNetworkStore.getState().setServerReachable(false)
      } else {
        useNetworkStore.getState().setServerReachable(true)
        if (axiosError.response.status === 401) {
          localStorage.removeItem('auth-store')
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api
