import api from '@/lib/axios'

// ── Types ─────────────────────────────────────────────────

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'

export interface MealRecipeSnippet {
  id: string
  title: string
  imageUrl: string | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  servings: number | null
}

export interface MealPlanItem {
  id: string
  mealPlanId: string
  date: string
  mealType: MealType
  recipeId: string | null
  customMealName: string | null
  notes: string | null
  recipe: MealRecipeSnippet | null
}

export interface MealPlan {
  id: string
  userId: string
  weekStartDate: string
}

export interface WeekDay {
  date: string
  breakfast: MealPlanItem | null
  lunch: MealPlanItem | null
  dinner: MealPlanItem | null
  snack: MealPlanItem | null
}

export interface WeekView {
  mealPlan: MealPlan | null
  weekStartDate: string
  weekEndDate: string
  days: WeekDay[]
}

// ── API calls ─────────────────────────────────────────────

export const mealPlanApi = {
  getWeekView: async (date?: string): Promise<WeekView> => {
    const res = await api.get('/meal-plans/week', { params: date ? { date } : {} })
    return res.data.data
  },

  createMealPlan: async (weekStartDate: string): Promise<MealPlan> => {
    const res = await api.post('/meal-plans', { weekStartDate })
    return res.data.data.mealPlan
  },

  addMealItem: async (
    mealPlanId: string,
    item: {
      date: string
      mealType: MealType
      recipeId?: string
      customMealName?: string
      notes?: string
    }
  ): Promise<MealPlanItem> => {
    const res = await api.post(`/meal-plans/${mealPlanId}/items`, item)
    return res.data.data.item
  },

  updateMealItem: async (
    itemId: string,
    data: { customMealName?: string; notes?: string }
  ): Promise<MealPlanItem> => {
    const res = await api.put(`/meal-plans/items/${itemId}`, data)
    return res.data.data.item
  },

  deleteMealItem: async (itemId: string): Promise<void> => {
    await api.delete(`/meal-plans/items/${itemId}`)
  },

  generateAIMealPlan: async (
    weekStartDate: string,
    preferences?: string
  ): Promise<WeekView> => {
    await api.post('/ai/generate-meal-plan', { weekStartDate, preferences })
    // Fetch fresh week view after AI populates it
    const res = await api.get('/meal-plans/week', { params: { date: weekStartDate } })
    return res.data.data
  },
}
