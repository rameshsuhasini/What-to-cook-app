import axios from 'axios'

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

export default api
