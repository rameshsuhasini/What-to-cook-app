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
   */
  async generateGroceryList(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const { mealPlanId } = req.body as { mealPlanId: string }
      const list = await groceryService.generateFromMealPlan(userId, mealPlanId)

      res.status(201).json({ success: true, data: { list } })
    } catch (error) {
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
