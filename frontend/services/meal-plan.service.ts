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
    preferences?: string,
    targetDates?: string[],
    usePantry?: boolean
  ): Promise<{ weekView: WeekView; newItemIds: string[] }> => {
    // AI call can take 15-25s on hosted infra — use a generous timeout
    const aiRes = await api.post(
      '/ai/generate-meal-plan',
      { weekStartDate, preferences, targetDates, usePantry },
      { timeout: 90_000 }
    )
    // Use only the newly created item IDs returned by the backend
    const newItemIds: string[] = aiRes.data?.data?.newItemIds ?? []

    // Fetch fresh week view after AI populates it
    const weekRes = await api.get('/meal-plans/week', { params: { date: weekStartDate } })
    return { weekView: weekRes.data.data, newItemIds }
  },

  generateSlotRecipe: async (mealPlanItemId: string): Promise<void> => {
    await api.post(
      '/ai/generate-slot-recipe',
      { mealPlanItemId },
      { timeout: 60_000 }
    )
  },

  generateBatchSlotRecipes: async (
    itemIds: string[]
  ): Promise<{ completed: number; total: number }> => {
    // All slots generated in parallel on the backend — one call replaces N sequential calls
    const res = await api.post(
      '/ai/generate-batch-slot-recipes',
      { itemIds },
      { timeout: 120_000 }
    )
    return res.data.data
  },
}
