// ─────────────────────────────────────────
// Health Controller
//
// Controllers ONLY handle:
// - Reading from req
// - Calling the service
// - Writing to res
//
// NO business logic here — ever.
// ─────────────────────────────────────────

import { Request, Response, NextFunction } from 'express'
import healthService from '../services/health.service'

export class HealthController {
  // ── Weight Logs ──────────────────────────

  /**
   * GET /api/health/weight-logs
   * Protected — returns weight logs with trend stats
   * Query params: ?from=2024-01-01&to=2024-01-31&limit=90
   */
  async getWeightLogs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const q = req.query as Record<string, string | undefined>

      const result = await healthService.getWeightLogs(userId, {
        from: q.from,
        to: q.to,
        limit: q.limit ? Number(q.limit) : undefined,
      })

      res.status(200).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/health/weight-logs
   * Protected — logs a weight entry (upserts by date)
   */
  async logWeight(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const log = await healthService.logWeight(userId, req.body)

      res.status(201).json({ success: true, data: { log } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/health/weight-logs/:id
   * Protected — deletes a weight log entry
   */
  async deleteWeightLog(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const logId = req.params.id as string
      await healthService.deleteWeightLog(userId, logId)

      res.status(200).json({
        success: true,
        data: { message: 'Weight log deleted' },
      })
    } catch (error) {
      next(error)
    }
  }

  // ── Nutrition Logs ───────────────────────

  /**
   * GET /api/health/nutrition-logs
   * Protected — returns nutrition logs with averages and today's log
   * Query params: ?from=2024-01-01&to=2024-01-31&limit=30
   */
  async getNutritionLogs(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const q = req.query as Record<string, string | undefined>

      const result = await healthService.getNutritionLogs(userId, {
        from: q.from,
        to: q.to,
        limit: q.limit ? Number(q.limit) : undefined,
      })

      res.status(200).json({ success: true, data: result })
    } catch (error) {
      next(error)
    }
  }

  /**
   * POST /api/health/nutrition-logs
   * Protected — logs nutrition for a day (upserts by date)
   */
  async logNutrition(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const log = await healthService.logNutrition(userId, req.body)

      res.status(201).json({ success: true, data: { log } })
    } catch (error) {
      next(error)
    }
  }

  /**
   * DELETE /api/health/nutrition-logs/:id
   * Protected — deletes a nutrition log entry
   */
  async deleteNutritionLog(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user!.userId
      const logId = req.params.id as string
      await healthService.deleteNutritionLog(userId, logId)

      res.status(200).json({
        success: true,
        data: { message: 'Nutrition log deleted' },
      })
    } catch (error) {
      next(error)
    }
  }
}

export default new HealthController()
