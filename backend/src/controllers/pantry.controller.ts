// ─────────────────────────────────────────
// Pantry Controller
//
// Controllers ONLY handle:
// - Reading from req
// - Calling the service
// - Writing to res
//
// NO business logic here — ever.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import pantryService from '../services/pantry.service'

export class PantryController {
  /**
   * GET /api/pantry
   * Protected — returns paginated pantry items
   */
  async getPantryItems(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const q = req.query as Record<string, string | undefined>

      const result = await pantryService.getPantryItems(userId, {
        search: q.search,
        page: q.page ? Number(q.page) : undefined,
        limit: q.limit ? Number(q.limit) : undefined,
      })

      res.status(200).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/pantry
   * Protected — adds a single pantry item
   * Merges with existing item if duplicate
   */
  async addPantryItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const item = await pantryService.addPantryItem(userId, req.body)

      res.status(201).json({ success: true, data: { item } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/pantry/bulk
   * Protected — bulk adds pantry items
   */
  async bulkAddPantryItems(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const { items } = req.body as { items: any[] }
      const result = await pantryService.bulkAddPantryItems(userId, items)

      res.status(201).json({ success: true, data: { items: result } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * PUT /api/pantry/:id
   * Protected — updates a pantry item
   */
  async updatePantryItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const itemId = req.params.id as string
      const item = await pantryService.updatePantryItem(userId, itemId, req.body)

      res.status(200).json({ success: true, data: { item } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/pantry/clear
   * Protected — clears entire pantry
   * Must be before /:id to avoid param conflict
   */
  async clearPantry(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      await pantryService.clearPantry(userId)

      res.status(200).json({
        success: true,
        data: { message: 'Pantry cleared successfully' },
      })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/pantry/:id
   * Protected — deletes a single pantry item
   */
  async deletePantryItem(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const itemId = req.params.id as string
      await pantryService.deletePantryItem(userId, itemId)

      res.status(200).json({
        success: true,
        data: { message: 'Item removed from pantry' },
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new PantryController()
