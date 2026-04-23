// ─────────────────────────────────────────
// Recipe Import Controller
//
// Handles POST /api/recipes/import-url
// Fetches content from a YouTube or recipe page URL,
// extracts the recipe via Claude AI, and saves it to DB.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { UserContext } from '../ai/types/ai.types'
import recipeImportService from '../services/recipeImport.service'
import recipeRepository from '../repositories/recipe.repository'

export class RecipeImportController {
  private async getUserContext(userId: string): Promise<UserContext> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) throw new Error('User not found')

    const latestWeight = await prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { logDate: 'desc' },
      select: { weightKg: true },
    })

    return {
      name: user.name,
      dietType: user.profile?.dietType ?? 'NONE',
      calorieGoal: user.profile?.calorieGoal ?? null,
      proteinGoal: user.profile?.proteinGoal ?? null,
      carbGoal: user.profile?.carbGoal ?? null,
      fatGoal: user.profile?.fatGoal ?? null,
      allergies: user.profile?.allergies ?? null,
      healthConditions: user.profile?.healthConditions ?? null,
      foodPreferences: user.profile?.foodPreferences ?? null,
      currentWeightKg: latestWeight ? Number(latestWeight.weightKg) : null,
      targetWeightKg: user.profile?.targetWeightKg
        ? Number(user.profile.targetWeightKg)
        : null,
    }
  }

  /**
   * POST /api/recipes/import-url
   * Body: { url: string }
   * Imports a recipe from a YouTube video or public recipe page.
   */
  async importFromUrl(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const { url } = req.body

      const userContext = await this.getUserContext(userId)

      const { recipe, sourceType, imageUrl } = await recipeImportService.importFromUrl(url, userContext)

      // Save to DB, attaching the extracted image URL from the source page
      const saved = await recipeRepository.create({ ...recipe, imageUrl: imageUrl ?? undefined }, userId, true)

      res.status(201).json({
        success: true,
        data: {
          recipe: saved,
          sourceType,
          macrosEstimated: true, // always flag as estimated for imported recipes
        },
      })
    } catch (error) {
      // Known user-facing errors — return 422 with descriptive message
      if (error instanceof Error) {
        const userFacingPhrases = [
          'Invalid YouTube URL',
          'no transcript',
          'Could not retrieve',
          'requires a login',
          'does not exist (404)',
          'too long to respond',
          'does not point to a web page',
          'behind a paywall',
          'not valid',
          'No recipe found',
          'Could not extract',
        ]
        const isUserFacing = userFacingPhrases.some((phrase) =>
          error.message.includes(phrase)
        )
        if (isUserFacing) {
          res.status(422).json({ success: false, message: error.message })
          return
        }
      }
      next(error)
    }
  }
}

export default new RecipeImportController()
