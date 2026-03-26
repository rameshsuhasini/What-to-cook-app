// ─────────────────────────────────────────
// Meal Plan Types & DTOs
// ─────────────────────────────────────────

import { MealType } from '@prisma/client'

// ── Input DTOs ──────────────────────────

export interface CreateMealPlanItemDTO {
  date: string           // ISO date string e.g. "2024-01-15"
  mealType: MealType
  recipeId?: string
  customMealName?: string
  notes?: string
}

export interface CreateMealPlanDTO {
  weekStartDate: string  // ISO date string — must be a Monday
  items?: CreateMealPlanItemDTO[]
}

export interface UpdateMealPlanItemDTO {
  date?: string
  mealType?: MealType
  recipeId?: string | null
  customMealName?: string | null
  notes?: string | null
}

// ── Response shapes ──────────────────────

export interface MealPlanItemResponse {
  id: string
  mealPlanId: string
  date: Date
  mealType: MealType
  recipeId: string | null
  customMealName: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
  recipe: {
    id: string
    title: string
    imageUrl: string | null
    prepTimeMinutes: number | null
    cookTimeMinutes: number | null
    calories: number | null
    servings: number | null
  } | null
}

export interface MealPlanResponse {
  id: string
  userId: string
  weekStartDate: Date
  createdAt: Date
  updatedAt: Date
  items: MealPlanItemResponse[]
}

// ── Week view helper ─────────────────────
// Groups meal plan items by date for easy
// rendering on the frontend calendar view

export interface WeekDayMeals {
  date: string   // ISO date string
  breakfast: MealPlanItemResponse | null
  lunch: MealPlanItemResponse | null
  dinner: MealPlanItemResponse | null
  snack: MealPlanItemResponse | null
}

export interface WeekViewResponse {
  mealPlan: MealPlanResponse | null
  weekStartDate: string
  weekEndDate: string
  days: WeekDayMeals[]
}
