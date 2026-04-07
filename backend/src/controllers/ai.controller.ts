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
import { UserContext, AIMealPlanMeal } from '../ai/types/ai.types'
import { generateRecipe } from '../ai/recipeGeneratorAI'
import { generateMealPlan } from '../ai/mealPlanAI'
import { generateHealthInsights } from '../ai/healthInsightsAI'
import { generatePantrySuggestions } from '../ai/pantrySuggestionsAI'
import recipeRepository from '../repositories/recipe.repository'
import mealPlanRepository from '../repositories/meal-plan.repository'
import healthRepository from '../repositories/health.repository'
import pantryRepository from '../repositories/pantry.repository'

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

      res.status(201).json({
        success: true,
        data: { recipe: saved },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * Generate a full recipe from a meal plan slot and save it to the DB.
   * First checks if the user already has a recipe with the same title —
   * if so, reuses it instead of generating a duplicate.
   * Returns the saved recipe ID on success, or null if generation fails.
   * Failure is intentionally swallowed so one bad slot never kills the whole plan.
   */
  private async generateAndSaveRecipe(
    meal: AIMealPlanMeal,
    userContext: UserContext,
    userId: string
  ): Promise<string | null> {
    try {
      // Reuse existing recipe if the AI picked a title already in the library
      const existing = await recipeRepository.findByTitle(meal.title, userId)
      if (existing) return existing.id

      const aiRecipe = await generateRecipe(
        { prompt: `${meal.title} — ${meal.description}` },
        userContext
      )
      const saved = await recipeRepository.create(aiRecipe, userId, true)
      return saved.id
    } catch {
      // Fall back to custom meal name for this slot — don't abort the whole plan
      return null
    }
  }

  /**
   * POST /api/ai/generate-meal-plan
   * Generates a 7-day meal plan, creates a full recipe for every slot in
   * parallel, then links each meal plan item to its recipe via recipeId.
   * Falls back to customMealName for any slot where recipe generation fails.
   */
  async generateMealPlan(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const userContext = await this.getUserContext(userId)

      const aiPlan = await generateMealPlan(req.body, userContext)

      // Use the requested weekStartDate — not the AI's returned value —
      // so the plan always lands on the correct DB week record.
      const requestedDate = new Date(req.body.weekStartDate)

      // Upsert the meal plan for this week
      let mealPlan = await mealPlanRepository.findByWeek(userId, requestedDate)
      if (!mealPlan) {
        mealPlan = await mealPlanRepository.create(userId, requestedDate)
      }

      const mealPlanId = mealPlan.id

      // Generate full recipes for every meal slot in parallel (per day),
      // then save each meal plan item once its recipe ID is known.
      await Promise.all(
        aiPlan.days.map(async (day) => {
          const slots = [
            { mealType: 'BREAKFAST' as const, meal: day.breakfast },
            { mealType: 'LUNCH'     as const, meal: day.lunch     },
            { mealType: 'DINNER'    as const, meal: day.dinner    },
            ...(day.snack ? [{ mealType: 'SNACK' as const, meal: day.snack }] : []),
          ]

          await Promise.all(
            slots.map(async ({ mealType, meal }) => {
              const recipeId = await this.generateAndSaveRecipe(meal, userContext, userId)

              await mealPlanRepository.addItem(mealPlanId, {
                date: day.date,
                mealType,
                // Prefer the linked recipe; fall back to plain text if generation failed
                recipeId:       recipeId ?? undefined,
                customMealName: recipeId ? undefined : meal.title,
                notes:          recipeId ? undefined : `${meal.description} (~${meal.estimatedCalories} kcal)`,
              })
            })
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
