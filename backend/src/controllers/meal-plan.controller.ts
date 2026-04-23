// ─────────────────────────────────────────
// Meal Plan Controller
//
// Controllers ONLY handle:
// - Reading from req
// - Calling the service
// - Writing to res
//
// NO business logic here — ever.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import mealPlanService from '../services/meal-plan.service'
import { achievementService } from '../services/achievement.service'
import prisma from '../lib/prisma'

export class MealPlanController {
  /**
   * GET /api/meal-plans/week
   * Protected — returns 7-day structured week view
   * Query param: ?date=2024-01-15 (defaults to current week)
   */
  async getWeekView(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const date = req.query.date as string | undefined

      const weekView = await mealPlanService.getWeekView(userId, date)

      res.status(200).json({ success: true, data: weekView })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/meal-plans
   * Protected — creates a meal plan for a week
   * Upserts — returns existing plan if one already exists
   */
  async createMealPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const mealPlan = await mealPlanService.createMealPlan(userId, req.body)

      const totalPlans = await prisma.mealPlan.count({ where: { userId } })
      achievementService.onMealPlanCreated(userId, totalPlans).catch(() => {})

      res.status(201).json({ success: true, data: { mealPlan } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/meal-plans/:id/items
   * Protected — adds a single meal item to a plan
   */
  async addMealItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const mealPlanId = req.params.id as string

      const item = await mealPlanService.addMealItem(userId, mealPlanId, req.body)

      res.status(201).json({ success: true, data: { item } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/meal-plans/items/:itemId
   * Protected — updates a single meal item
   */
  async updateMealItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const itemId = req.params.itemId as string

      const item = await mealPlanService.updateMealItem(userId, itemId, req.body)

      res.status(200).json({ success: true, data: { item } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/meal-plans/items/:itemId
   * Protected — deletes a single meal item
   */
  async deleteMealItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const itemId = req.params.itemId as string

      await mealPlanService.deleteMealItem(userId, itemId)

      res.status(200).json({
        success: true,
        data: { message: 'Meal item removed successfully' },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/meal-plans/:id
   * Protected — deletes entire meal plan for a week
   */
  async deleteMealPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const mealPlanId = req.params.id as string

      await mealPlanService.deleteMealPlan(userId, mealPlanId)

      res.status(200).json({
        success: true,
        data: { message: 'Meal plan deleted successfully' },
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new MealPlanController()
