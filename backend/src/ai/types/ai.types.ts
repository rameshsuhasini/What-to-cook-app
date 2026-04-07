// ─────────────────────────────────────────
// AI Types & DTOs
// ─────────────────────────────────────────

import { DietType } from '@prisma/client'

// ── Shared user context ──────────────────
// Injected into every AI prompt to
// personalise responses

export interface UserContext {
  name: string
  dietType: DietType
  calorieGoal: number | null
  proteinGoal: number | null
  carbGoal: number | null
  fatGoal: number | null
  allergies: string | null
  healthConditions: string | null
  foodPreferences: string | null
  currentWeightKg: number | null
  targetWeightKg: number | null
}

// ── Recipe Generator ─────────────────────

export interface GenerateRecipeDTO {
  prompt: string              // User's natural language request
  cuisinePreference?: string  // e.g. "Italian", "Asian"
  maxCookTimeMinutes?: number
  servings?: number
  availableIngredients?: string[] // from pantry
}

export interface AIGeneratedRecipe {
  title: string
  description: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  calories: number
  protein: number
  carbs: number
  fat: number
  cuisine: string
  dietType: DietType
  ingredients: {
    ingredientName: string
    quantity: number
    unit: string
  }[]
  steps: {
    stepNumber: number
    instructionText: string
  }[]
  tips: string[]
}

// ── Meal Plan Generator ──────────────────

export interface GenerateMealPlanDTO {
  weekStartDate: string       // ISO date string
  preferences?: string        // Any extra user instructions
}

export interface AIMealPlanDay {
  date: string                // ISO date string
  breakfast: AIMealPlanMeal
  lunch: AIMealPlanMeal
  dinner: AIMealPlanMeal
  snack?: AIMealPlanMeal
}

export interface AIMealPlanMeal {
  title: string
  description: string
  estimatedCalories: number
  estimatedProtein: number
  estimatedCarbs: number
  estimatedFat: number
  prepTimeMinutes: number
}

export interface AIGeneratedMealPlan {
  weekStartDate: string
  totalDailyCalories: number
  days: AIMealPlanDay[]
  shoppingTips: string[]
  nutritionSummary: string
}

// ── Health Insights ──────────────────────

export interface GenerateHealthInsightsDTO {
  includeWeightTrend?: boolean
  includeNutritionAnalysis?: boolean
}

export interface AIHealthInsights {
  overview: string
  weightInsights: string | null
  nutritionInsights: string | null
  recommendations: string[]
  weeklyGoals: string[]
  motivationalMessage: string
}

// ── Pantry Suggestions ───────────────────

export interface GeneratePantrySuggestionsDTO {
  maxCookTimeMinutes?: number
  mealType?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
}

export interface AIPantryRecipeSuggestion {
  title: string
  description: string
  usedIngredients: string[]    // ingredients from pantry
  missingIngredients: string[] // ingredients to buy
  estimatedCalories: number
  prepTimeMinutes: number
  cookTimeMinutes: number
  difficulty: 'Easy' | 'Medium' | 'Hard'
  steps: string[]
}

export interface AIPantrySuggestions {
  suggestions: AIPantryRecipeSuggestion[]
  pantryHealthScore: number    // 0-100, how well-stocked the pantry is
  missingEssentials: string[]  // common pantry staples they're missing
}
