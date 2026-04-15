// ─────────────────────────────────────────
// Starter Recipe Pack AI
//
// Called once on onboarding completion.
// Stage 1: Plan a varied set of 6 recipe titles
//          tailored to the user's profile.
// Stage 2 (in controller): Generate each full
//          recipe in parallel and save to DB.
// ─────────────────────────────────────────

import { sendAIMessageJSON, TOKEN_LIMITS, JSON_INSTRUCTION } from './aiService'
import { UserContext } from './types/ai.types'
import { MealType } from '@prisma/client'

export interface StarterRecipePlan {
  title: string
  description: string
  mealType: MealType
}

const VALID_MEAL_TYPES = new Set<MealType>(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])

const buildSystemPrompt = (user: UserContext): string => `
You are a recipe curation AI for the "What to Cook?" app.

A new user has just finished setting up their profile. Your job is to select
a personalised starter collection of 6 real, well-known recipes that match
their dietary profile exactly.

The recipes will be fully generated in a follow-up step — here you only need
to provide the title, a short description, and the meal type.

USER PROFILE:
- Diet Type: ${user.dietType}
- Allergies/Intolerances: ${user.allergies || 'None'}
- Health Conditions: ${user.healthConditions || 'None'}
- Food Preferences: ${user.foodPreferences || 'None specified'}
- Daily Calorie Goal: ${user.calorieGoal ? `${user.calorieGoal} kcal` : 'Not set'}

RULES:
- ONLY suggest real dishes that exist in actual cuisines (not invented combinations)
- NEVER include any ingredient the user is allergic to
- Strictly respect the diet type (VEGETARIAN = no meat/fish, VEGAN = no animal products, KETO = low carb, etc.)
- Distribution: exactly 2 BREAKFAST, 2 LUNCH, 2 DINNER
- Aim for variety: different cuisines, cooking styles, and difficulty levels
- If a calorie goal is set, keep each recipe roughly within that range per serving
- Titles must be recognisable dish names a person could look up in a cookbook

${JSON_INSTRUCTION}

Respond with this exact JSON:
{
  "recipes": [
    {
      "title": "string — recognisable dish name",
      "description": "string — 1-2 appetising sentences",
      "mealType": "BREAKFAST|LUNCH|DINNER"
    }
  ]
}
`

/**
 * Generate a curated plan of 6 recipe titles for a new user.
 * Returns the plan to the controller which generates each full
 * recipe in parallel.
 */
export const generateStarterRecipePlan = async (
  user: UserContext
): Promise<StarterRecipePlan[]> => {
  const result = await sendAIMessageJSON<{ recipes: unknown[] }>({
    systemPrompt: buildSystemPrompt(user),
    userMessage: `Generate a personalised starter recipe collection for ${user.name}.`,
    maxTokens: TOKEN_LIMITS.starterRecipePack,
  })

  if (!Array.isArray(result?.recipes) || result.recipes.length === 0) {
    throw new Error('Starter pack AI returned no recipes')
  }

  const valid: StarterRecipePlan[] = (result.recipes as any[])
    .filter((r) => r && typeof r.title === 'string' && r.title.trim())
    .map((r) => ({
      title: String(r.title).trim(),
      description: String(r.description ?? '').trim(),
      mealType: VALID_MEAL_TYPES.has(r.mealType) ? (r.mealType as MealType) : 'DINNER',
    }))

  // Cap at 8 in case the AI returns extras
  return valid.slice(0, 8)
}
