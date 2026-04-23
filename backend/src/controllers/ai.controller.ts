// ─────────────────────────────────────────
// AI Controller
//
// Orchestrates all AI features:
// - Fetches full user context from DB
// - Calls the appropriate AI service
// - Optionally saves results to DB
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { UserContext } from '../ai/types/ai.types'
import { generateRecipe } from '../ai/recipeGeneratorAI'
import { generateMealPlan } from '../ai/mealPlanAI'
import { generateHealthInsights } from '../ai/healthInsightsAI'
import { generatePantrySuggestions } from '../ai/pantrySuggestionsAI'
import { generateStarterRecipePlan } from '../ai/starterRecipesAI'
import recipeRepository from '../repositories/recipe.repository'
import mealPlanRepository from '../repositories/meal-plan.repository'
import healthRepository from '../repositories/health.repository'
import pantryRepository from '../repositories/pantry.repository'
import { achievementService } from '../services/achievement.service'

export class AIController {
  /**
   * Fetch full user context from DB
   * Used to personalise every AI prompt
   */
  private async getUserContext(userId: string): Promise<UserContext> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    })

    if (!user) throw new Error('User not found')

    // Get most recent weight log for current weight
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
   * POST /api/ai/generate-recipe
   * Generates a recipe and optionally saves it to DB
   */
  async generateRecipe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const userContext = await this.getUserContext(userId)

      // Get pantry ingredients for context
      const pantryIngredients =
        await pantryRepository.getAllIngredientNames(userId)

      const aiRecipe = await generateRecipe(
        { ...req.body, availableIngredients: pantryIngredients },
        userContext
      )

      // Save to DB as an AI-generated recipe
      const saved = await recipeRepository.create(aiRecipe, userId, true)
      achievementService.onAiRecipeGenerated(userId).catch(() => {})

      res.status(201).json({
        success: true,
        data: { recipe: saved },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/ai/generate-meal-plan
   * Generates a 7-day meal plan and saves all meal slots immediately.
   * Slots are saved as customMealName (with AI-provided macros in notes)
   * so the response completes quickly without timing out on hosted platforms.
   * Full recipes are generated on-demand when a user opens a meal slot.
   */
  async generateMealPlan(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const userContext = await this.getUserContext(userId)

      // Fetch pantry so the AI can prioritise meals that use what's already at home
      const pantryIngredients = await pantryRepository.getAllIngredientNames(userId)

      const aiPlan = await generateMealPlan(
        { ...req.body, pantryIngredients },
        userContext
      )

      // Use the requested weekStartDate — not the AI's returned value —
      // so the plan always lands on the correct DB week record.
      const requestedDate = new Date(req.body.weekStartDate)

      // Upsert the meal plan for this week
      let mealPlan = await mealPlanRepository.findByWeek(userId, requestedDate)
      if (!mealPlan) {
        mealPlan = await mealPlanRepository.create(userId, requestedDate)
      }

      const mealPlanId = mealPlan.id

      // Save all meal slots immediately as named meals (no inline recipe generation).
      // This keeps the response well under platform timeout limits (~10s total).
      // The AI already provides title, description, and estimated macros — enough
      // to display a rich planner view. Recipe details can be generated on demand.
      await Promise.all(
        aiPlan.days.map(async (day) => {
          const slots = [
            { mealType: 'BREAKFAST' as const, meal: day.breakfast },
            { mealType: 'LUNCH'     as const, meal: day.lunch     },
            { mealType: 'DINNER'    as const, meal: day.dinner    },
            ...(day.snack ? [{ mealType: 'SNACK' as const, meal: day.snack }] : []),
          ]

          await Promise.all(
            slots.map(({ mealType, meal }) =>
              mealPlanRepository.addItem(mealPlanId, {
                date:           day.date,
                mealType,
                customMealName: meal.title,
                notes:          `${meal.description} (~${meal.estimatedCalories} kcal | P:${meal.estimatedProtein}g C:${meal.estimatedCarbs}g F:${meal.estimatedFat}g)`,
              })
            )
          )
        })
      )

      res.status(201).json({
        success: true,
        data: { mealPlan, aiPlan },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/ai/health-insights
   * Analyses health data and returns personalised insights
   */
  async generateHealthInsights(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const userContext = await this.getUserContext(userId)

      // Fetch last 30 days of health data in parallel
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const fromDate = thirtyDaysAgo.toISOString().split('T')[0]

      const [weightLogs, nutritionLogs, todayNutrition] = await Promise.all([
        healthRepository.findWeightLogs(userId, { from: fromDate, limit: 30 }),
        healthRepository.findNutritionLogs(userId, { from: fromDate, limit: 30 }),
        healthRepository.findTodayNutritionLog(userId),
      ])

      // Build trend objects for the AI
      const weightTrend = {
        logs: weightLogs.map((l) => ({ ...l, weightKg: Number(l.weightKg) })),
        stats: {
          current: weightLogs.length
            ? Number(weightLogs[weightLogs.length - 1].weightKg)
            : null,
          starting: weightLogs.length ? Number(weightLogs[0].weightKg) : null,
          lowest: weightLogs.length
            ? Math.min(...weightLogs.map((l) => Number(l.weightKg)))
            : null,
          highest: weightLogs.length
            ? Math.max(...weightLogs.map((l) => Number(l.weightKg)))
            : null,
          totalChange: null,
          averagePerWeek: null,
        },
      }

      const avg = (arr: (number | null)[]) => {
        const valid = arr.filter((v): v is number => v !== null)
        return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
      }

      const nutritionSummary = {
        logs: nutritionLogs,
        averages: {
          calories: avg(nutritionLogs.map((l) => l.calories)),
          protein: avg(nutritionLogs.map((l) => l.protein)),
          carbs: avg(nutritionLogs.map((l) => l.carbs)),
          fat: avg(nutritionLogs.map((l) => l.fat)),
        },
        today: todayNutrition,
      }

      const insights = await generateHealthInsights(
        userContext,
        weightTrend as any,
        nutritionSummary as any
      )

      res.status(200).json({ success: true, data: { insights } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/ai/generate-starter-pack
   * Called once after onboarding — generates a personalised set of 6 recipes.
   * Skips silently if the user already has recipes (idempotent).
   * Stage 1: AI plans 6 recipe titles based on user profile.
   * Stage 2: Each recipe is generated in full, in parallel.
   */
  async generateStarterPack(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId

      // Idempotency guard — skip if user already has recipes
      const existingTitles = await recipeRepository.findAllTitles(userId)
      if (existingTitles.length > 0) {
        res.status(200).json({ success: true, data: { generated: 0, skipped: true } })
        return
      }

      const userContext = await this.getUserContext(userId)

      // Stage 1: Get the planned recipe list from AI
      const plan = await generateStarterRecipePlan(userContext)

      // Stage 2: Generate each full recipe in parallel.
      // Individual failures are swallowed so one bad recipe
      // never kills the whole pack.
      const results = await Promise.allSettled(
        plan.map(async (item) => {
          const aiRecipe = await generateRecipe(
            { prompt: `${item.title} — ${item.description}` },
            userContext
          )
          return recipeRepository.create(aiRecipe, userId, true)
        })
      )

      const generated = results.filter((r) => r.status === 'fulfilled').length

      res.status(201).json({
        success: true,
        data: { generated, total: plan.length },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/ai/generate-slot-recipe
   * Generates a full recipe for a single meal plan item and links it.
   * Called sequentially by the frontend after a meal plan is created.
   * Pantry items are always used here — the toggle only affects title selection.
   * Idempotent: if the slot already has a recipeId, returns immediately.
   */
  async generateSlotRecipe(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const { mealPlanItemId } = req.body

      const item = await mealPlanRepository.findItemById(mealPlanItemId)
      if (!item || item.mealPlan.userId !== userId) {
        res.status(404).json({ success: false, message: 'Meal plan item not found' })
        return
      }

      // Idempotent — already has a linked recipe
      if (item.recipeId) {
        res.status(200).json({ success: true, data: { itemId: item.id } })
        return
      }

      const userContext = await this.getUserContext(userId)
      const pantryIngredients = await pantryRepository.getAllIngredientNames(userId)

      // Build a prompt that includes the meal type for better recipe targeting
      const mealLabel = item.mealType.charAt(0) + item.mealType.slice(1).toLowerCase()
      const prompt = `${item.customMealName ?? 'healthy meal'} (${mealLabel})`

      const aiRecipe = await generateRecipe(
        { prompt, availableIngredients: pantryIngredients },
        userContext
      )

      const savedRecipe = await recipeRepository.create(aiRecipe, userId, true)

      await mealPlanRepository.updateItem(item.id, { recipeId: savedRecipe.id })

      res.status(200).json({ success: true, data: { itemId: item.id } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/ai/pantry-suggestions
   * Suggests recipes based on pantry contents
   */
  async generatePantrySuggestions(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const userContext = await this.getUserContext(userId)

      // Get all pantry ingredient names
      const pantryIngredients =
        await pantryRepository.getAllIngredientNames(userId)

      const suggestions = await generatePantrySuggestions(
        pantryIngredients,
        userContext,
        req.body
      )

      res.status(200).json({ success: true, data: { suggestions } })
    } catch (error) {
      next(error)
    }
  }
}

export default new AIController()
