import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export interface WeightLog {
  id: string
  weightKg: number
  logDate: string
  notes: string | null
}

export interface NutritionLog {
  id: string
  calories: number
  protein: number
  carbs: number
  fat: number
  date: string
}

export interface WeightLogsResponse {
  logs: WeightLog[]
  stats: {
    current: number | null
    totalChange: number | null
    lowest: number | null
    highest: number | null
  }
}

export interface NutritionLogsResponse {
  logs: NutritionLog[]
  today: {
    calories: number
    protein: number
    carbs: number
    fat: number
  } | null
}

export const healthApi = {
  getWeightLogs: async (params?: { limit?: number }): Promise<WeightLogsResponse> => {
    const res = await api.get('/api/weight-logs', { params })
    return res.data.data
  },

  addWeightLog: async (payload: { weightKg: number; logDate: string; notes?: string }): Promise<WeightLog> => {
    const res = await api.post('/api/weight-logs', payload)
    return res.data.data.log
  },

  getNutritionLogs: async (params?: { limit?: number }): Promise<NutritionLogsResponse> => {
    const res = await api.get('/api/nutrition-logs', { params })
    return res.data.data
  },

  addNutritionLog: async (payload: {
    calories: number
    protein: number
    carbs: number
    fat: number
    date: string
  }): Promise<NutritionLog> => {
    const res = await api.post('/api/nutrition-logs', payload)
    return res.data.data.log
  },
}
