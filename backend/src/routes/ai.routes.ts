// ─────────────────────────────────────────
// AI Routes
//
// All AI endpoints are:
// - Protected (authentication required)
// - Rate limited (expensive Claude API calls)
// ─────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express'
import { body } from 'express-validator'
import aiController from '../controllers/ai.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

// ── Simple in-memory rate limiter ────────
// Limits each user to N AI calls per window.
// Replace with Redis-based limiter in production.

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const createRateLimiter = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user?.userId
    if (!userId) {
      next()
      return
    }

    const now = Date.now()
    const key = `${req.path}:${userId}`
    const record = rateLimitStore.get(key)

    if (!record || now > record.resetAt) {
      // New window
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs })
      next()
      return
    }

    if (record.count >= maxRequests) {
      const retryAfterSecs = Math.ceil((record.resetAt - now) / 1000)
      res.status(429).json({
        success: false,
        message: `Too many AI requests. Please wait ${retryAfterSecs} seconds before trying again.`,
      })
      return
    }

    record.count++
    next()
  }
}

// 5 AI calls per user per 10 minutes
const aiRateLimit = createRateLimiter(5, 10 * 60 * 1000)

// ── POST /api/ai/generate-recipe ─────────
router.post(
  '/generate-recipe',
  authenticate,
  aiRateLimit,
  [
    body('prompt')
      .trim()
      .notEmpty().withMessage('Recipe prompt is required')
      .isLength({ min: 3, max: 500 }).withMessage('Prompt must be 3–500 characters'),
    body('cuisinePreference')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Cuisine must be under 100 characters'),
    body('maxCookTimeMinutes')
      .optional()
      .isInt({ min: 5, max: 480 }).withMessage('Max cook time must be 5–480 minutes'),
    body('servings')
      .optional()
      .isInt({ min: 1, max: 50 }).withMessage('Servings must be 1–50'),
  ],
  validate,
  aiController.generateRecipe.bind(aiController)
)

// ── POST /api/ai/generate-meal-plan ──────
router.post(
  '/generate-meal-plan',
  authenticate,
  aiRateLimit,
  [
    body('weekStartDate')
      .notEmpty().withMessage('weekStartDate is required')
      .isISO8601().withMessage('weekStartDate must be a valid ISO date'),
    body('preferences')
      .optional()
      .trim()
      .isLength({ max: 500 }).withMessage('Preferences must be under 500 characters'),
  ],
  validate,
  aiController.generateMealPlan.bind(aiController)
)

// ── POST /api/ai/health-insights ─────────
router.post(
  '/health-insights',
  authenticate,
  aiRateLimit,
  aiController.generateHealthInsights.bind(aiController)
)

// ── POST /api/ai/generate-starter-pack ───
// One-time call on onboarding completion.
// Generous timeout — generates 6 recipes in parallel (~20-30s).
// Rate limited to 1 call per hour per user (it's idempotent anyway).
router.post(
  '/generate-starter-pack',
  authenticate,
  createRateLimiter(1, 60 * 60 * 1000),
  aiController.generateStarterPack.bind(aiController)
)

// ── POST /api/ai/generate-slot-recipe ────
// Generates a full recipe for a single meal plan item.
// Called sequentially by the frontend (one per meal slot).
// More generous rate limit since it's triggered automatically.
router.post(
  '/generate-slot-recipe',
  authenticate,
  createRateLimiter(30, 10 * 60 * 1000),
  [
    body('mealPlanItemId')
      .notEmpty().withMessage('mealPlanItemId is required')
      .isString().withMessage('mealPlanItemId must be a string'),
  ],
  validate,
  aiController.generateSlotRecipe.bind(aiController)
)

// ── POST /api/ai/generate-batch-slot-recipes ──
// Generates recipes for multiple meal plan slots in parallel.
// One call replaces N sequential slot-recipe calls.
router.post(
  '/generate-batch-slot-recipes',
  authenticate,
  createRateLimiter(10, 10 * 60 * 1000),
  [
    body('itemIds')
      .isArray({ min: 1 }).withMessage('itemIds must be a non-empty array'),
    body('itemIds.*')
      .isString().withMessage('Each itemId must be a string'),
  ],
  validate,
  aiController.generateBatchSlotRecipes.bind(aiController)
)

// ── POST /api/ai/save-pantry-recipe ──────
router.post(
  '/save-pantry-recipe',
  authenticate,
  [
    body('title').trim().notEmpty().withMessage('title is required'),
    body('steps').isArray({ min: 1 }).withMessage('steps must be a non-empty array'),
    body('usedIngredients').isArray().withMessage('usedIngredients must be an array'),
    body('missingIngredients').isArray().withMessage('missingIngredients must be an array'),
  ],
  validate,
  aiController.savePantryRecipe.bind(aiController)
)

// ── POST /api/ai/pantry-suggestions ──────
router.post(
  '/pantry-suggestions',
  authenticate,
  aiRateLimit,
  [
    body('maxCookTimeMinutes')
      .optional()
      .isInt({ min: 5, max: 480 }).withMessage('Max cook time must be 5–480 minutes'),
    body('mealType')
      .optional()
      .isIn(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])
      .withMessage('Invalid meal type'),
  ],
  validate,
  aiController.generatePantrySuggestions.bind(aiController)
)

export default router
