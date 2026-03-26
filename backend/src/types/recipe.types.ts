// ─────────────────────────────────────────
// Recipe Types & DTOs
//
// DTOs define the exact shape of data coming
// IN and going OUT of the recipe API.
// Keeps the API contract explicit and safe.
// ─────────────────────────────────────────

import { DietType } from '@prisma/client'

// ── Input DTOs ──────────────────────────

export interface CreateRecipeIngredientDTO {
  ingredientName: string
  quantity?: number
  unit?: string
}

export interface CreateRecipeStepDTO {
  stepNumber: number
  instructionText: string
}

export interface CreateRecipeDTO {
  title: string
  description?: string
  imageUrl?: string
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  servings?: number
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  cuisine?: string
  dietType?: DietType
  ingredients: CreateRecipeIngredientDTO[]
  steps: CreateRecipeStepDTO[]
}

export interface UpdateRecipeDTO {
  title?: string
  description?: string
  imageUrl?: string
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  servings?: number
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
  cuisine?: string
  dietType?: DietType
  ingredients?: CreateRecipeIngredientDTO[]
  steps?: CreateRecipeStepDTO[]
}

export interface RecipeQueryDTO {
  page?: number
  limit?: number
  search?: string
  dietType?: DietType
  cuisine?: string
  maxCalories?: number
  minProtein?: number
  isAiGenerated?: boolean
}

// ── Response shapes ──────────────────────

export interface RecipeIngredientResponse {
  id: string
  ingredientName: string
  quantity: number | null
  unit: string | null
}

export interface RecipeStepResponse {
  id: string
  stepNumber: number
  instructionText: string
}

export interface RecipeResponse {
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
  isAiGenerated: boolean
  createdByUserId: string | null
  createdAt: Date
  updatedAt: Date
  ingredients: RecipeIngredientResponse[]
  steps: RecipeStepResponse[]
  isSaved?: boolean // populated for authenticated requests
}

export interface PaginatedRecipesResponse {
  recipes: RecipeResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
