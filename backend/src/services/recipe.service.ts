// ─────────────────────────────────────────
// Recipe Service
//
// All business logic for recipes lives here:
// - Ownership checks before mutations
// - Pagination calculation
// - Save/unsave recipe logic
// - Input normalisation
//
// Never touches req/res — that's the
// controller's job.
// ─────────────────────────────────────────

import recipeRepository from '../repositories/recipe.repository'
import {
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeQueryDTO,
  PaginatedRecipesResponse,
  RecipeResponse,
} from '../types/recipe.types'

export class RecipeService {
  /**
   * GET ALL RECIPES
   * Paginated, filterable list with optional save state
   */
  async getRecipes(
    query: RecipeQueryDTO,
    userId?: string
  ): Promise<PaginatedRecipesResponse> {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(50, Math.max(1, query.limit ?? 12)) // cap at 50

    const { recipes, total } = await recipeRepository.findAll(
      { ...query, page, limit },
      userId
    )

    const totalPages = Math.ceil(total / limit)

    return {
      recipes: recipes as RecipeResponse[],
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * GET SINGLE RECIPE
   * Returns full recipe with ingredients, steps, and save state
   */
  async getRecipeById(id: string, userId?: string): Promise<RecipeResponse> {
    const recipe = await recipeRepository.findById(id, userId)

    if (!recipe) {
      throw new Error('Recipe not found')
    }

    return recipe as RecipeResponse
  }

  /**
   * CREATE RECIPE
   * Validates required fields then delegates to repository
   */
  async createRecipe(
    data: CreateRecipeDTO,
    userId: string
  ): Promise<RecipeResponse> {
    // Validate ingredients are not empty
    if (!data.ingredients || data.ingredients.length === 0) {
      throw new Error('Recipe must have at least one ingredient')
    }

    // Validate steps are not empty
    if (!data.steps || data.steps.length === 0) {
      throw new Error('Recipe must have at least one step')
    }

    // Validate step numbers are sequential and unique
    const stepNumbers = data.steps.map((s) => s.stepNumber)
    const uniqueStepNumbers = new Set(stepNumbers)
    if (uniqueStepNumbers.size !== stepNumbers.length) {
      throw new Error('Recipe steps must have unique step numbers')
    }

    // Validate nutrition values are non-negative if provided
    const nutritionFields = ['calories', 'protein', 'carbs', 'fat'] as const
    for (const field of nutritionFields) {
      if (data[field] !== undefined && data[field]! < 0) {
        throw new Error(`${field} cannot be negative`)
      }
    }

    const recipe = await recipeRepository.create(data, userId)
    return recipe as RecipeResponse
  }

  /**
   * UPDATE RECIPE
   * Only the owner can update their recipe
   */
  async updateRecipe(
    id: string,
    data: UpdateRecipeDTO,
    userId: string
  ): Promise<RecipeResponse> {
    // Check recipe exists
    const existing = await recipeRepository.findById(id)
    if (!existing) {
      throw new Error('Recipe not found')
    }

    // Only owner can update
    const isOwner = await recipeRepository.isOwner(id, userId)
    if (!isOwner) {
      throw new Error('You do not have permission to update this recipe')
    }

    // Validate steps if provided
    if (data.steps && data.steps.length === 0) {
      throw new Error('Recipe must have at least one step')
    }

    // Validate ingredients if provided
    if (data.ingredients && data.ingredients.length === 0) {
      throw new Error('Recipe must have at least one ingredient')
    }

    const recipe = await recipeRepository.update(id, data)
    return recipe as RecipeResponse
  }

  /**
   * DELETE RECIPE
   * Only the owner can delete their recipe
   */
  async deleteRecipe(id: string, userId: string): Promise<void> {
    // Check recipe exists
    const existing = await recipeRepository.findById(id)
    if (!existing) {
      throw new Error('Recipe not found')
    }

    // Only owner can delete
    const isOwner = await recipeRepository.isOwner(id, userId)
    if (!isOwner) {
      throw new Error('You do not have permission to delete this recipe')
    }

    await recipeRepository.delete(id)
  }

  /**
   * SAVE RECIPE
   * Add a recipe to the user's saved collection
   */
  async saveRecipe(recipeId: string, userId: string): Promise<void> {
    // Verify recipe exists before saving
    const recipe = await recipeRepository.findById(recipeId)
    if (!recipe) {
      throw new Error('Recipe not found')
    }

    await recipeRepository.saveRecipe(userId, recipeId)
  }

  /**
   * UNSAVE RECIPE
   * Remove a recipe from the user's saved collection
   */
  async unsaveRecipe(recipeId: string, userId: string): Promise<void> {
    try {
      await recipeRepository.unsaveRecipe(userId, recipeId)
    } catch {
      // If the record doesn't exist, treat as a no-op
      // (idempotent behaviour — safe to call even if not saved)
    }
  }

  /**
   * GET SAVED RECIPES
   * Returns all recipes saved by the user
   */
  async getSavedRecipes(userId: string): Promise<RecipeResponse[]> {
    const saved = await recipeRepository.getSavedRecipes(userId)
    return saved as RecipeResponse[]
  }
}

export default new RecipeService()
