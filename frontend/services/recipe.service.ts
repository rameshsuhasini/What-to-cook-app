import api from '@/lib/axios'

// ── Types ────────────────────────────────────────────────

export type DietType =
  | 'NONE'
  | 'VEGETARIAN'
  | 'VEGAN'
  | 'KETO'
  | 'PALEO'
  | 'GLUTEN_FREE'
  | 'DAIRY_FREE'
  | 'HALAL'
  | 'KOSHER'

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'

export interface RecipeIngredient {
  id: string
  ingredientName: string
  quantity: number | null
  unit: string | null
}

export interface RecipeStep {
  id: string
  stepNumber: number
  instructionText: string
}

export interface Recipe {
  id: string
  title: string
  description: string | null
  imageUrl: string | null
  prepTimeMinutes: number | null
  cookTimeMinutes: number | null
  servings: number | null
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  cuisine: string | null
  dietType: DietType
  mealType: MealType | null
  isAiGenerated: boolean
  createdByUserId: string | null
  createdAt: string
  updatedAt: string
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  isSaved?: boolean
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface RecipeListResult {
  recipes: Recipe[]
  pagination: Pagination
}

export interface RecipeQuery {
  page?: number
  limit?: number
  search?: string
  dietType?: DietType
  mealType?: MealType
  cuisine?: string
  maxCalories?: number
  maxCookTime?: number
  isAiGenerated?: boolean
}

export interface GenerateRecipePayload {
  prompt: string
  cuisinePreference?: string
  maxCookTimeMinutes?: number
  servings?: number
}

export interface CreateRecipePayload {
  title: string
  description?: string
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  servings?: number
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  cuisine?: string
  dietType?: DietType
  ingredients: { ingredientName: string; quantity?: number; unit?: string }[]
  steps: { stepNumber: number; instructionText: string }[]
}

// ── API calls ─────────────────────────────────────────────

export const recipeApi = {
  getRecipes: async (query: RecipeQuery = {}): Promise<RecipeListResult> => {
    const params = new URLSearchParams()
    if (query.page)           params.set('page', String(query.page))
    if (query.limit)          params.set('limit', String(query.limit))
    if (query.search)         params.set('search', query.search)
    if (query.dietType)       params.set('dietType', query.dietType)
    if (query.mealType)       params.set('mealType', query.mealType)
    if (query.cuisine)        params.set('cuisine', query.cuisine)
    if (query.maxCalories)    params.set('maxCalories', String(query.maxCalories))
    if (query.maxCookTime)    params.set('maxCookTime', String(query.maxCookTime))
    if (query.isAiGenerated !== undefined)
      params.set('isAiGenerated', String(query.isAiGenerated))

    const qs = params.toString()
    const res = await api.get(`/recipes${qs ? `?${qs}` : ''}`)
    return res.data.data
  },

  getRecipeById: async (id: string): Promise<Recipe> => {
    const res = await api.get(`/recipes/${id}`)
    return res.data.data.recipe
  },

  getSavedRecipes: async (): Promise<Recipe[]> => {
    const res = await api.get('/recipes/saved')
    return res.data.data.recipes
  },

  saveRecipe: async (recipeId: string): Promise<void> => {
    await api.post('/recipes/save', { recipeId })
  },

  unsaveRecipe: async (recipeId: string): Promise<void> => {
    await api.delete(`/recipes/save/${recipeId}`)
  },

  createRecipe: async (payload: CreateRecipePayload): Promise<Recipe> => {
    const res = await api.post('/recipes', payload)
    return res.data.data.recipe
  },

  deleteRecipe: async (id: string): Promise<void> => {
    await api.delete(`/recipes/${id}`)
  },

  generateRecipe: async (payload: GenerateRecipePayload): Promise<Recipe> => {
    const res = await api.post('/ai/generate-recipe', payload)
    return res.data.data.recipe
  },
}
