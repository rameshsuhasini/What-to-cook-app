// ─────────────────────────────────────────
// Health Routes
// ─────────────────────────────────────────

import { Router } from 'express'
import { body, param, query } from 'express-validator'
import healthController from '../controllers/health.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

// ── Weight Log Routes ────────────────────

// GET /api/health/weight-logs
router.get(
  '/weight-logs',
  authenticate,
  [
    query('from').optional().isISO8601().withMessage('from must be a valid date'),
    query('to').optional().isISO8601().withMessage('to must be a valid date'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('limit must be 1–365'),
  ],
  validate,
  healthController.getWeightLogs.bind(healthController)
)

// POST /api/health/weight-logs
router.post(
  '/weight-logs',
  authenticate,
  [
    body('weightKg')
      .notEmpty().withMessage('weightKg is required')
      .isFloat({ min: 1, max: 700 })
      .withMessage('Weight must be between 1 and 700 kg'),
    body('logDate')
      .notEmpty().withMessage('logDate is required')
      .isISO8601().withMessage('logDate must be a valid ISO date'),
  ],
  validate,
  healthController.logWeight.bind(healthController)
)

// DELETE /api/health/weight-logs/:id
router.delete(
  '/weight-logs/:id',
  authenticate,
  [param('id').notEmpty().withMessage('Log ID is required')],
  validate,
  healthController.deleteWeightLog.bind(healthController)
)

// ── Nutrition Log Routes ─────────────────

// GET /api/health/nutrition-logs
router.get(
  '/nutrition-logs',
  authenticate,
  [
    query('from').optional().isISO8601().withMessage('from must be a valid date'),
    query('to').optional().isISO8601().withMessage('to must be a valid date'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 365 })
      .withMessage('limit must be 1–365'),
  ],
  validate,
  healthController.getNutritionLogs.bind(healthController)
)

// POST /api/health/nutrition-logs
router.post(
  '/nutrition-logs',
  authenticate,
  [
    body('date')
      .notEmpty().withMessage('date is required')
      .isISO8601().withMessage('date must be a valid ISO date'),
    body('calories')
      .optional()
      .isInt({ min: 0, max: 20000 })
      .withMessage('calories must be 0–20000'),
    body('protein')
      .optional()
      .isInt({ min: 0, max: 1000 })
      .withMessage('protein must be 0–1000g'),
    body('carbs')
      .optional()
      .isInt({ min: 0, max: 2000 })
      .withMessage('carbs must be 0–2000g'),
    body('fat')
      .optional()
      .isInt({ min: 0, max: 1000 })
      .withMessage('fat must be 0–1000g'),
  ],
  validate,
  healthController.logNutrition.bind(healthController)
)

// DELETE /api/health/nutrition-logs/:id
router.delete(
  '/nutrition-logs/:id',
  authenticate,
  [param('id').notEmpty().withMessage('Log ID is required')],
  validate,
  healthController.deleteNutritionLog.bind(healthController)
)

export default router
