// ─────────────────────────────────────────
// Recipe Import AI
//
// Extracts a structured recipe from raw content
// sourced from a YouTube video or external recipe page.
// The content may be messy — Claude cleans and structures it.
// ─────────────────────────────────────────

import { sendAIMessageJSON, TOKEN_LIMITS, JSON_INSTRUCTION } from './aiService'
import { UserContext, AIGeneratedRecipe } from './types/ai.types'

export interface ImportRecipeDTO {
  rawContent: string   // transcript, page text, or description
  sourceUrl: string    // original URL for reference
  sourceType: 'youtube' | 'webpage'
}

const buildSystemPrompt = (user: UserContext): string => `
You are an expert chef and nutritionist AI for the "What to Cook?" app.
Your job is to extract a complete, structured recipe from raw content (YouTube transcript, recipe page text, etc.).
The content may be messy, informal, or incomplete — do your best to produce a clean, accurate recipe.

USER PROFILE (use to adapt diet type and flag allergen conflicts):
- Diet Type: ${user.dietType}
- Allergies/Intolerances: ${user.allergies || 'None'}
- Health Conditions: ${user.healthConditions || 'None'}

EXTRACTION RULES:
- Extract ONLY the recipe present in the content — do not invent or add your own
- If quantities or units are missing, estimate based on standard cooking knowledge
- If macros/nutrition are not stated, estimate them accurately per serving
- Ingredients MUST include exact quantities and units where possible
- Steps MUST be ordered and clear — rewrite informal spoken language into clean instructions
- If multiple recipes are present, extract only the primary/main one
- dietType must reflect what the recipe actually is, regardless of user's diet
- If the content does not contain a recipe at all, respond with: { "error": "No recipe found in the provided content" }

${JSON_INSTRUCTION}

Respond with this exact JSON schema:
{
  "title": "string",
  "description": "string (2-3 sentences, appetising description)",
  "prepTimeMinutes": number,
  "cookTimeMinutes": number,
  "servings": number,
  "calories": number (per serving, estimate if not stated),
  "protein": number (grams per serving),
  "carbs": number (grams per serving),
  "fat": number (grams per serving),
  "cuisine": "string",
  "dietType": "NONE|VEGETARIAN|VEGAN|KETO|PALEO|GLUTEN_FREE|DAIRY_FREE|HALAL|KOSHER",
  "mealType": "BREAKFAST|LUNCH|DINNER|SNACK",
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
  "tips": ["string (any tips, variations or notes from the source)"]
}
`

const buildUserMessage = (dto: ImportRecipeDTO): string => `
Source type: ${dto.sourceType === 'youtube' ? 'YouTube video' : 'Recipe webpage'}
Source URL: ${dto.sourceUrl}

--- RAW CONTENT START ---
${dto.rawContent.slice(0, 12000)}
--- RAW CONTENT END ---

Extract the recipe from the content above and return the structured JSON.
`

const validateImportedRecipe = (recipe: Record<string, unknown>): AIGeneratedRecipe => {
  if (recipe.error) {
    throw new Error(recipe.error as string)
  }

  const required = [
    'title', 'description', 'prepTimeMinutes', 'cookTimeMinutes',
    'servings', 'calories', 'protein', 'carbs', 'fat',
    'cuisine', 'dietType', 'ingredients', 'steps',
  ]

  for (const field of required) {
    if (recipe[field] === undefined || recipe[field] === null) {
      throw new Error(`Could not extract required field "${field}" from the provided URL`)
    }
  }

  if (!Array.isArray(recipe.ingredients) || (recipe.ingredients as unknown[]).length === 0) {
    throw new Error('Could not extract ingredients from the provided URL')
  }

  if (!Array.isArray(recipe.steps) || (recipe.steps as unknown[]).length === 0) {
    throw new Error('Could not extract recipe steps from the provided URL')
  }

  return {
    ...(recipe as unknown as AIGeneratedRecipe),
    prepTimeMinutes:  Math.max(0, Math.min(480, recipe.prepTimeMinutes as number)),
    cookTimeMinutes:  Math.max(0, Math.min(480, recipe.cookTimeMinutes as number)),
    servings:         Math.max(1, Math.min(50,  recipe.servings as number)),
    calories:         Math.max(0, Math.min(5000, recipe.calories as number)),
    protein:          Math.max(0, Math.min(500,  recipe.protein as number)),
    carbs:            Math.max(0, Math.min(1000, recipe.carbs as number)),
    fat:              Math.max(0, Math.min(500,  recipe.fat as number)),
    tips:             Array.isArray(recipe.tips) ? recipe.tips as string[] : [],
  }
}

export const extractRecipeFromContent = async (
  dto: ImportRecipeDTO,
  user: UserContext
): Promise<AIGeneratedRecipe> => {
  const recipe = await sendAIMessageJSON<Record<string, unknown>>({
    systemPrompt: buildSystemPrompt(user),
    userMessage:  buildUserMessage(dto),
    maxTokens:    TOKEN_LIMITS.recipeGenerator,
  })

  return validateImportedRecipe(recipe)
}
