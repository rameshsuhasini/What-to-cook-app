// ─────────────────────────────────────────
// Recipe Generator AI
//
// Generates a complete recipe based on:
// - User's natural language prompt
// - Their diet type and allergies
// - Available pantry ingredients
// - Nutritional goals
// ─────────────────────────────────────────

import { sendAIMessageJSON, TOKEN_LIMITS, JSON_INSTRUCTION } from './aiService'
import { UserContext, GenerateRecipeDTO, AIGeneratedRecipe } from './types/ai.types'
import { DietType } from '@prisma/client'

/**
 * Build the system prompt for recipe generation.
 * Injects full user context so Claude understands
 * exactly what kind of recipe to generate.
 */
const buildSystemPrompt = (user: UserContext): string => `
You are an expert chef and nutritionist AI assistant for the "What to Cook?" app.
You create personalised, delicious recipes tailored to the user's specific needs.

USER PROFILE:
- Name: ${user.name}
- Diet Type: ${user.dietType}
- Allergies/Intolerances: ${user.allergies || 'None'}
- Health Conditions: ${user.healthConditions || 'None'}
- Food Preferences: ${user.foodPreferences || 'None specified'}
- Daily Calorie Goal: ${user.calorieGoal ? `${user.calorieGoal} kcal` : 'Not set'}
- Protein Goal: ${user.proteinGoal ? `${user.proteinGoal}g` : 'Not set'}
- Carb Goal: ${user.carbGoal ? `${user.carbGoal}g` : 'Not set'}
- Fat Goal: ${user.fatGoal ? `${user.fatGoal}g` : 'Not set'}

RULES:
- ONLY generate recipes that are real, well-known dishes that actually exist in the world
- DO NOT invent creative food combinations that nobody actually cooks or eats (e.g. "spicy protein shake", "avocado espresso bowl")
- The recipe title must be a dish someone could look up and find in a real cookbook or reputable food website
- NEVER include ingredients the user is allergic to
- Respect the user's diet type strictly (e.g. no meat for VEGETARIAN)
- Aim for the calorie and macro goals if set
- Ingredients MUST include exact quantities and units (e.g. "2 cups", "1 tsp", "200g") — never vague amounts
- Steps MUST be detailed, clear, and ordered — each step should be a complete, actionable instruction
- Include at least 5 steps for any non-trivial recipe
- Provide accurate nutritional estimates per serving

${JSON_INSTRUCTION}

Respond with this exact JSON schema:
{
  "title": "string",
  "description": "string (2-3 sentences, appetising description)",
  "prepTimeMinutes": number,
  "cookTimeMinutes": number,
  "servings": number,
  "calories": number (per serving),
  "protein": number (grams per serving),
  "carbs": number (grams per serving),
  "fat": number (grams per serving),
  "cuisine": "string",
  "dietType": "NONE|VEGETARIAN|VEGAN|KETO|PALEO|GLUTEN_FREE|DAIRY_FREE|HALAL|KOSHER",
  "mealType": "BREAKFAST|LUNCH|DINNER|SNACK (pick the most appropriate one)",
  "ingredients": [
    {
      "ingredientName": "string",
      "quantity": number,
      "unit": "string (g, ml, cup, tbsp, tsp, piece, etc.)"
    }
  ],
  "steps": [
    {
      "stepNumber": number,
      "instructionText": "string (clear, detailed instruction)"
    }
  ],
  "tips": ["string (cooking tips, variations, storage advice)"]
}
`

/**
 * Build the user message for recipe generation
 */
const buildUserMessage = (
  dto: GenerateRecipeDTO,
  user: UserContext
): string => {
  const parts = [`Generate a recipe for: "${dto.prompt}"`]

  if (dto.cuisinePreference) {
    parts.push(`Preferred cuisine: ${dto.cuisinePreference}`)
  }

  if (dto.maxCookTimeMinutes) {
    parts.push(`Maximum cook time: ${dto.maxCookTimeMinutes} minutes`)
  }

  if (dto.servings) {
    parts.push(`Servings needed: ${dto.servings}`)
  }

  if (dto.availableIngredients && dto.availableIngredients.length > 0) {
    parts.push(
      `Pantry ingredients to use if possible: ${dto.availableIngredients.join(', ')}`
    )
  }

  return parts.join('\n')
}

/**
 * Validate the AI-generated recipe has required fields
 * and sensible values before saving to DB
 */
const validateRecipe = (recipe: any): AIGeneratedRecipe => {
  const required = [
    'title', 'description', 'prepTimeMinutes', 'cookTimeMinutes',
    'servings', 'calories', 'protein', 'carbs', 'fat',
    'cuisine', 'dietType', 'ingredients', 'steps',
  ]

  for (const field of required) {
    if (recipe[field] === undefined || recipe[field] === null) {
      throw new Error(`AI recipe missing required field: ${field}`)
    }
  }

  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    throw new Error('AI recipe must have at least one ingredient')
  }

  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    throw new Error('AI recipe must have at least one step')
  }

  // Clamp values to sensible ranges
  return {
    ...recipe,
    prepTimeMinutes: Math.max(0, Math.min(480, recipe.prepTimeMinutes)),
    cookTimeMinutes: Math.max(0, Math.min(480, recipe.cookTimeMinutes)),
    servings: Math.max(1, Math.min(50, recipe.servings)),
    calories: Math.max(0, Math.min(5000, recipe.calories)),
    protein: Math.max(0, Math.min(500, recipe.protein)),
    carbs: Math.max(0, Math.min(1000, recipe.carbs)),
    fat: Math.max(0, Math.min(500, recipe.fat)),
    tips: Array.isArray(recipe.tips) ? recipe.tips : [],
  }
}

/**
 * Generate a recipe using Claude AI
 */
export const generateRecipe = async (
  dto: GenerateRecipeDTO,
  user: UserContext
): Promise<AIGeneratedRecipe> => {
  const recipe = await sendAIMessageJSON<AIGeneratedRecipe>({
    systemPrompt: buildSystemPrompt(user),
    userMessage: buildUserMessage(dto, user),
    maxTokens: TOKEN_LIMITS.recipeGenerator,
  })

  return validateRecipe(recipe)
}
