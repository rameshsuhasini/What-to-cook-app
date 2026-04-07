import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

export interface HealthInsights {
  overview: string
  recommendations: string[]
  motivationalMessage: string
}

export interface GeneratedRecipe {
  title: string
  description: string
  ingredients: { name: string; amount: string; unit: string }[]
  steps: { stepNumber: number; instruction: string }[]
  prepTime: number
  cookTime: number
  servings: number
  calories: number
  protein: number
  carbs: number
  fat: number
}

export const aiApi = {
  generateHealthInsights: async (): Promise<HealthInsights> => {
    const res = await api.post('/api/ai/health-insights')
    return res.data.data.insights
  },

  generateRecipe: async (payload: {
    prompt: string
    dietType?: string
    allergies?: string
    servings?: number
  }): Promise<GeneratedRecipe> => {
    const res = await api.post('/api/ai/generate-recipe', payload)
    return res.data.data.recipe
  },

  generateMealPlan: async (payload: {
    weekStart: string
    preferences?: string
  }): Promise<{ days: Record<string, unknown> }> => {
    const res = await api.post('/api/ai/generate-meal-plan', payload)
    return res.data.data
  },

  getPantrySuggestions: async (): Promise<{ suggestions: string[] }> => {
    const res = await api.post('/api/ai/pantry-suggestions')
    return res.data.data
  },
}
