// ─────────────────────────────────────────
// Grocery Controller
//
// Controllers ONLY handle:
// - Reading from req
// - Calling the service
// - Writing to res
//
// NO business logic here — ever.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import groceryService from '../services/grocery.service'

export class GroceryController {
  /**
   * GET /api/groceries
   * Protected — returns latest grocery list grouped by category
   */
  async getGroceryList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const list = await groceryService.getGroceryList(userId)

      res.status(200).json({ success: true, data: { list } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * GET /api/groceries/:id
   * Protected — returns a specific grocery list by ID
   */
  async getGroceryListById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const id = req.params.id as string
      const list = await groceryService.getGroceryListById(id, userId)

      res.status(200).json({ success: true, data: { list } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/groceries/generate
   * Protected — generates a grocery list from a meal plan
   *
   * Body:
   *   mealPlanId: string   — required
   *   dates?: string[]     — ISO date strings to include; omit for full week
   *   mode?: 'replace' | 'merge'  — default 'replace'
   */
  async generateGroceryList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const { mealPlanId, dates, mode } = req.body as {
        mealPlanId: string
        dates?: string[]
        mode?: 'replace' | 'merge'
      }
      const list = await groceryService.generateFromMealPlan(userId, mealPlanId, { dates, mode })

      res.status(201).json({ success: true, data: { list } })
    } catch (error) {
      // Known user-facing errors — return a friendly 409 instead of a 500
      if (error instanceof Error) {
        const msg = error.message
        if (msg.includes('No new ingredients')) {
          res.status(409).json({
            success: false,
            message: 'Grocery list already up to date — no new ingredients to add for the selected days.',
          })
          return
        }
        if (msg.includes('No ingredients found')) {
          res.status(409).json({
            success: false,
            message: 'No ingredients found for the selected days. Make sure your meals have linked recipes.',
          })
          return
        }
        if (msg.includes('pantry already covers')) {
          res.status(409).json({
            success: false,
            message: 'Your pantry already covers everything needed for the selected days. Nothing to add!',
          })
          return
        }
      }
      next(error)
    }
  }

  /**
   * POST /api/groceries/:id/items
   * Protected — manually adds an item to a grocery list
   */
  async addItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const groceryListId = req.params.id as string
      const item = await groceryService.addItem(userId, groceryListId, req.body)

      res.status(201).json({ success: true, data: { item } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/groceries/item/:itemId
   * Protected — updates a grocery item (check, rename, etc.)
   */
  async updateItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const itemId = req.params.itemId as string
      const item = await groceryService.updateItem(userId, itemId, req.body)

      res.status(200).json({ success: true, data: { item } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/groceries/item/:itemId
   * Protected — deletes a grocery item
   */
  async deleteItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const itemId = req.params.itemId as string
      await groceryService.deleteItem(userId, itemId)

      res.status(200).json({
        success: true,
        data: { message: 'Item removed successfully' },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/groceries/:id
   * Protected — deletes an entire grocery list and all its items
   */
  async deleteList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const id = req.params.id as string
      await groceryService.deleteList(userId, id)

      res.status(200).json({
        success: true,
        data: { message: 'Grocery list deleted' },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/groceries/:id/check-all
   * Protected — checks or unchecks all items in a list
   */
  async checkAllItems(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const groceryListId = req.params.id as string
      const { isChecked } = req.body as { isChecked: boolean }

      await groceryService.checkAllItems(userId, groceryListId, isChecked)

      res.status(200).json({
        success: true,
        data: {
          message: isChecked ? 'All items checked' : 'All items unchecked',
        },
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new GroceryController()
