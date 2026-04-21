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

const buildSystemPrompt = (user: UserContext, dayCount: number, pantry: string[]): string => `
You are a meal planning AI for the "What to Cook?" app.
Generate a concise ${dayCount}-day meal plan. Be brief — short titles and one-sentence descriptions only.

USER PROFILE:
- Diet Type: ${user.dietType}
- Allergies: ${user.allergies || 'None'}
- Health Conditions: ${user.healthConditions || 'None'}
- Food Preferences: ${user.foodPreferences || 'None'}
- Daily Calorie Goal: ${user.calorieGoal ? `${user.calorieGoal} kcal` : 'use healthy defaults'}
- Protein Goal: ${user.proteinGoal ? `${user.proteinGoal}g` : 'not set'}
- Carb Goal: ${user.carbGoal ? `${user.carbGoal}g` : 'not set'}
- Fat Goal: ${user.fatGoal ? `${user.fatGoal}g` : 'not set'}
${pantry.length > 0 ? `\nPANTRY (already at home): ${pantry.join(', ')}` : ''}

RULES:
- Never include allergens, strictly respect diet type
- Vary meals — no repeated dinners
- Keep titles short (3-5 words), descriptions one sentence max
${pantry.length > 0 ? '- Prioritise meals that use pantry ingredients above — help the user avoid waste' : ''}

${JSON_INSTRUCTION}

Respond with ONLY this JSON (no shoppingTips, no nutritionSummary):
{
  "weekStartDate": "string",
  "totalDailyCalories": number,
  "days": [
    {
      "date": "string",
      "breakfast": { "title": "string", "description": "string", "estimatedCalories": number, "estimatedProtein": number, "estimatedCarbs": number, "estimatedFat": number, "prepTimeMinutes": number },
      "lunch": { same },
      "dinner": { same },
      "snack": { same, optional }
    }
  ]
}
`

const buildUserMessage = (
  dto: GenerateMealPlanDTO,
  targetDates: string[],
  user: UserContext
): string => {
  const parts = [
    `Generate a ${targetDates.length}-day meal plan.`,
    `Fill ONLY these ${targetDates.length} date(s): ${targetDates.join(', ')}`,
    `The "days" array in your response must contain exactly ${targetDates.length} entries — one per date listed above. Do not add or omit any dates.`,
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

const validateMealPlan = (plan: any, expectedDays: number): AIGeneratedMealPlan => {
  if (!plan.days || !Array.isArray(plan.days) || plan.days.length === 0) {
    throw new Error('AI meal plan returned no days')
  }

  // Trim extra days if AI returned more than requested; accept fewer gracefully
  const days = plan.days.slice(0, expectedDays).filter(
    (day: any) => day.breakfast && day.lunch && day.dinner
  )

  if (days.length === 0) {
    throw new Error('AI meal plan days are missing required meals')
  }

  return {
    ...plan,
    days,
    shoppingTips: [],
    nutritionSummary: '',
  }
}

export const generateMealPlan = async (
  dto: GenerateMealPlanDTO,
  user: UserContext
): Promise<AIGeneratedMealPlan> => {
  const targetDates = dto.targetDates && dto.targetDates.length > 0
    ? dto.targetDates
    : getWeekDates(dto.weekStartDate)

  // Respect the usePantry flag — default is true (inject pantry context)
  const pantry = dto.usePantry === false ? [] : (dto.pantryIngredients ?? [])

  const plan = await sendAIMessageJSON<AIGeneratedMealPlan>({
    systemPrompt: buildSystemPrompt(user, targetDates.length, pantry),
    userMessage: buildUserMessage(dto, targetDates, user),
    maxTokens: TOKEN_LIMITS.mealPlanGenerator,
  })

  return validateMealPlan(plan, targetDates.length)
}
