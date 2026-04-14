import api from '@/lib/axios'

export interface HealthInsights {
  overview: string
  recommendations: string[]
  motivationalMessage: string
}

export interface PantryRecipeSuggestion {
  title: string
  description: string
  usedIngredients: string[]
  missingIngredients: string[]
  estimatedCalories: number
  prepTimeMinutes: number
  cookTimeMinutes: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  steps: string[]
}

export interface AIPantrySuggestions {
  suggestions: PantryRecipeSuggestion[]
  pantryHealthScore: number
  missingEssentials: string[]
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
    const res = await api.post('/ai/health-insights')
    return res.data.data.insights
  },

  generateRecipe: async (payload: {
    prompt: string
    dietType?: string
    allergies?: string
    servings?: number
  }): Promise<GeneratedRecipe> => {
    const res = await api.post('/ai/generate-recipe', payload)
    return res.data.data.recipe
  },

  generateMealPlan: async (payload: {
    weekStart: string
    preferences?: string
  }): Promise<{ days: Record<string, unknown> }> => {
    const res = await api.post('/ai/generate-meal-plan', payload)
    return res.data.data
  },

  getPantrySuggestions: async (): Promise<AIPantrySuggestions> => {
    const res = await api.post('/ai/pantry-suggestions')
    return res.data.data.suggestions
  },
}
