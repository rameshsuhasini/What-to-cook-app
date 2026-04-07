// ─────────────────────────────────────────
// Pantry Suggestions AI
//
// Suggests recipes based on what the user
// already has in their pantry.
// Minimises food waste and extra shopping.
// ─────────────────────────────────────────

import { sendAIMessageJSON, TOKEN_LIMITS, JSON_INSTRUCTION } from './aiService'
import {
  UserContext,
  GeneratePantrySuggestionsDTO,
  AIPantrySuggestions,
} from './types/ai.types'

const buildSystemPrompt = (user: UserContext): string => `
You are a creative chef AI for the "What to Cook?" app.
You specialise in creating delicious recipes from whatever ingredients are available,
minimising food waste and extra shopping.

USER PROFILE:
- Name: ${user.name}
- Diet Type: ${user.dietType}
- Allergies/Intolerances: ${user.allergies || 'None'}
- Health Conditions: ${user.healthConditions || 'None'}
- Food Preferences: ${user.foodPreferences || 'None specified'}
- Daily Calorie Goal: ${user.calorieGoal ? `${user.calorieGoal} kcal` : 'Not set'}

SUGGESTION RULES:
- Prioritise recipes that use the most pantry ingredients
- NEVER use allergens
- Strictly respect diet type
- Be creative — combine ingredients in interesting ways
- Clearly separate which ingredients are in the pantry vs need to be bought
- Estimate a pantry health score (0-100) based on how well-stocked it is
- Identify missing pantry essentials (olive oil, salt, basic spices etc.)

${JSON_INSTRUCTION}

Respond with this exact JSON schema:
{
  "suggestions": [
    {
      "title": "string",
      "description": "string (appetising 1-2 sentence description)",
      "usedIngredients": ["string (ingredients from the pantry)"],
      "missingIngredients": ["string (ingredients that need to be bought)"],
      "estimatedCalories": number (per serving),
      "prepTimeMinutes": number,
      "cookTimeMinutes": number,
      "difficulty": "Easy|Medium|Hard",
      "steps": ["string (clear cooking steps)"]
    }
  ],
  "pantryHealthScore": number (0-100),
  "missingEssentials": ["string (common staples they're missing)"]
}
`

const buildUserMessage = (
  pantryIngredients: string[],
  dto: GeneratePantrySuggestionsDTO
): string => {
  const parts = []

  if (pantryIngredients.length === 0) {
    parts.push(
      'The user has an empty pantry. Suggest 3 simple recipes they could make with the most basic ingredients and list everything they need to buy.'
    )
  } else {
    parts.push(
      `Generate 3 recipe suggestions using these pantry ingredients:\n${pantryIngredients.join(', ')}`
    )
  }

  if (dto.maxCookTimeMinutes) {
    parts.push(`Maximum total time (prep + cook): ${dto.maxCookTimeMinutes} minutes`)
  }

  if (dto.mealType) {
    parts.push(`Meal type preference: ${dto.mealType}`)
  }

  parts.push('Prioritise recipes that use the most pantry ingredients to minimise shopping.')

  return parts.join('\n')
}

const validateSuggestions = (result: any): AIPantrySuggestions => {
  if (!result.suggestions || !Array.isArray(result.suggestions)) {
    throw new Error('AI pantry suggestions missing suggestions array')
  }

  return {
    suggestions: result.suggestions.map((s: any) => ({
      title: s.title || 'Untitled Recipe',
      description: s.description || '',
      usedIngredients: Array.isArray(s.usedIngredients) ? s.usedIngredients : [],
      missingIngredients: Array.isArray(s.missingIngredients) ? s.missingIngredients : [],
      estimatedCalories: Number(s.estimatedCalories) || 0,
      prepTimeMinutes: Number(s.prepTimeMinutes) || 0,
      cookTimeMinutes: Number(s.cookTimeMinutes) || 0,
      difficulty: ['Easy', 'Medium', 'Hard'].includes(s.difficulty)
        ? s.difficulty
        : 'Medium',
      steps: Array.isArray(s.steps) ? s.steps : [],
    })),
    pantryHealthScore: Math.max(0, Math.min(100, Number(result.pantryHealthScore) || 0)),
    missingEssentials: Array.isArray(result.missingEssentials)
      ? result.missingEssentials
      : [],
  }
}

export const generatePantrySuggestions = async (
  pantryIngredients: string[],
  user: UserContext,
  dto: GeneratePantrySuggestionsDTO
): Promise<AIPantrySuggestions> => {
  const result = await sendAIMessageJSON<AIPantrySuggestions>({
    systemPrompt: buildSystemPrompt(user),
    userMessage: buildUserMessage(pantryIngredients, dto),
    maxTokens: TOKEN_LIMITS.pantrySuggestions,
  })

  return validateSuggestions(result)
}
