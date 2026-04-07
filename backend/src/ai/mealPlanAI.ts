// ─────────────────────────────────────────
// Meal Plan Generator AI
//
// Generates a full 7-day meal plan based on:
// - User's diet type and nutritional goals
// - Allergies and food preferences
// - Weight and health goals
// ─────────────────────────────────────────

import { sendAIMessageJSON, TOKEN_LIMITS, JSON_INSTRUCTION } from './aiService'
import { UserContext, GenerateMealPlanDTO, AIGeneratedMealPlan } from './types/ai.types'

/**
 * Build week dates from a Monday start date
 */
const getWeekDates = (weekStartDate: string): string[] => {
  const monday = new Date(weekStartDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  })
}

const buildSystemPrompt = (user: UserContext): string => `
You are an expert nutritionist and meal planning AI for the "What to Cook?" app.
You create practical, delicious, and nutritionally balanced 7-day meal plans.

USER PROFILE:
- Name: ${user.name}
- Diet Type: ${user.dietType}
- Allergies/Intolerances: ${user.allergies || 'None'}
- Health Conditions: ${user.healthConditions || 'None'}
- Food Preferences: ${user.foodPreferences || 'None specified'}
- Daily Calorie Goal: ${user.calorieGoal ? `${user.calorieGoal} kcal` : 'Not set (use healthy defaults)'}
- Protein Goal: ${user.proteinGoal ? `${user.proteinGoal}g` : 'Not set'}
- Carb Goal: ${user.carbGoal ? `${user.carbGoal}g` : 'Not set'}
- Fat Goal: ${user.fatGoal ? `${user.fatGoal}g` : 'Not set'}
- Current Weight: ${user.currentWeightKg ? `${user.currentWeightKg}kg` : 'Not set'}
- Target Weight: ${user.targetWeightKg ? `${user.targetWeightKg}kg` : 'Not set'}

MEAL PLANNING RULES:
- NEVER include allergens
- Strictly respect diet type
- Vary meals throughout the week — no repeated dinners
- Balance nutrition across meals to hit daily goals
- Keep meals practical — achievable for a home cook
- Consider meal prep efficiency — suggest batch cooking where sensible
- Each meal must have estimated calories and macros

${JSON_INSTRUCTION}

Respond with this exact JSON schema:
{
  "weekStartDate": "string (ISO date)",
  "totalDailyCalories": number (target daily calories),
  "days": [
    {
      "date": "string (ISO date)",
      "breakfast": {
        "title": "string",
        "description": "string",
        "estimatedCalories": number,
        "estimatedProtein": number,
        "estimatedCarbs": number,
        "estimatedFat": number,
        "prepTimeMinutes": number
      },
      "lunch": { same structure as breakfast },
      "dinner": { same structure as breakfast },
      "snack": { same structure as breakfast, optional }
    }
  ],
  "shoppingTips": ["string (practical shopping and prep tips)"],
  "nutritionSummary": "string (2-3 sentence overview of the week's nutrition)"
}
`

const buildUserMessage = (
  dto: GenerateMealPlanDTO,
  weekDates: string[],
  user: UserContext
): string => {
  const parts = [
    `Generate a 7-day meal plan for the week starting ${dto.weekStartDate}.`,
    `The 7 dates are: ${weekDates.join(', ')}`,
  ]

  if (dto.preferences) {
    parts.push(`Additional preferences: ${dto.preferences}`)
  }

  if (user.targetWeightKg && user.currentWeightKg) {
    const diff = user.targetWeightKg - user.currentWeightKg
    const goal = diff < 0 ? 'lose weight' : diff > 0 ? 'gain weight' : 'maintain weight'
    parts.push(`Weight goal: ${goal} (current: ${user.currentWeightKg}kg, target: ${user.targetWeightKg}kg)`)
  }

  return parts.join('\n')
}

const validateMealPlan = (plan: any): AIGeneratedMealPlan => {
  if (!plan.days || !Array.isArray(plan.days) || plan.days.length !== 7) {
    throw new Error('AI meal plan must have exactly 7 days')
  }

  for (const day of plan.days) {
    if (!day.breakfast || !day.lunch || !day.dinner) {
      throw new Error('Each day must have breakfast, lunch, and dinner')
    }
  }

  return {
    ...plan,
    shoppingTips: Array.isArray(plan.shoppingTips) ? plan.shoppingTips : [],
    nutritionSummary: plan.nutritionSummary || '',
  }
}

export const generateMealPlan = async (
  dto: GenerateMealPlanDTO,
  user: UserContext
): Promise<AIGeneratedMealPlan> => {
  const weekDates = getWeekDates(dto.weekStartDate)

  const plan = await sendAIMessageJSON<AIGeneratedMealPlan>({
    systemPrompt: buildSystemPrompt(user),
    userMessage: buildUserMessage(dto, weekDates, user),
    maxTokens: TOKEN_LIMITS.mealPlanGenerator,
  })

  return validateMealPlan(plan)
}
