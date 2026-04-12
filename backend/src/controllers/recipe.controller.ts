// ─────────────────────────────────────────
// Recipe Controller
//
// Controllers ONLY handle:
// - Reading from req
// - Calling the service
// - Writing to res
//
// NO business logic here — ever.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import recipeService from '../services/recipe.service'
import { DietType, MealType } from '@prisma/client'

export class RecipeController {
  /**
   * GET /api/recipes
   * Public — returns paginated list of recipes
   * Optional: authenticated user sees isSaved state
   */
  async getRecipes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.userId

      // Cast query params to string — Express types them as
      // string | ParsedQs | string[] | ParsedQs[] but after
      // express-validator they are always simple strings
      const q = req.query as Record<string, string | undefined>

      const query = {
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
        search: q.search,
        dietType: q.dietType as DietType | undefined,
        mealType: q.mealType as MealType | undefined,
        cuisine: q.cuisine,
        maxCalories: q.maxCalories ? Number(q.maxCalories) : undefined,
        minProtein: q.minProtein ? Number(q.minProtein) : undefined,
        maxCookTime: q.maxCookTime ? Number(q.maxCookTime) : undefined,
        isAiGenerated:
          q.isAiGenerated !== undefined
            ? q.isAiGenerated === 'true'
            : undefined,
      }

      const result = await recipeService.getRecipes(query, userId)

      res.status(200).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/recipes/saved
   * Protected — returns current user's saved recipes
   * NOTE: This route must be registered BEFORE /api/recipes/:id
   */
  async getSavedRecipes(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const recipes = await recipeService.getSavedRecipes(userId)

      res.status(200).json({ success: true, data: { recipes } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/recipes/:id
   * Public — returns single recipe with full details
   */
  async getRecipeById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string
      const userId = req.user?.userId
      const recipe = await recipeService.getRecipeById(id, userId)

      res.status(200).json({ success: true, data: { recipe } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/recipes
   * Protected — creates a new recipe
   */
  async createRecipe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const recipe = await recipeService.createRecipe(req.body, userId)

      res.status(201).json({ success: true, data: { recipe } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/recipes/:id
   * Protected — updates a recipe (owner only)
   */
  async updateRecipe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string
      const userId = req.user!.userId
      const recipe = await recipeService.updateRecipe(id, req.body, userId)

      res.status(200).json({ success: true, data: { recipe } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/recipes/:id
   * Protected — deletes a recipe (owner only)
   */
  async deleteRecipe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string
      const userId = req.user!.userId
      await recipeService.deleteRecipe(id, userId)

      res.status(200).json({
        success: true,
        data: { message: 'Recipe deleted successfully' },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/recipes/save
   * Protected — saves a recipe to user's collection
   */
  async saveRecipe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const recipeId = req.body.recipeId as string
      await recipeService.saveRecipe(recipeId, userId)

      res.status(200).json({
        success: true,
        data: { message: 'Recipe saved successfully' },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/recipes/save/:id
   * Protected — removes a recipe from user's saved collection
   */
  async unsaveRecipe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const recipeId = req.params.id as string
      await recipeService.unsaveRecipe(recipeId, userId)

      res.status(200).json({
        success: true,
        data: { message: 'Recipe removed from saved' },
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new RecipeController()