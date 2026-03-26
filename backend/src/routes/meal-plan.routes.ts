// ─────────────────────────────────────────
// Meal Plan Routes
// ─────────────────────────────────────────

import { Router } from 'express'
import { body, param, query } from 'express-validator'
import mealPlanController from '../controllers/meal-plan.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK']

// ── Shared meal item validation rules ────
const mealItemValidation = [
  body('date')
    .notEmpty().withMessage('Date is required')
    .isISO8601().withMessage('Date must be a valid ISO date (e.g. 2024-01-15)'),
  body('mealType')
    .notEmpty().withMessage('Meal type is required')
    .isIn(VALID_MEAL_TYPES).withMessage(`Meal type must be one of: ${VALID_MEAL_TYPES.join(', ')}`),
  body('recipeId')
    .optional({ nullable: true })
    .isString().withMessage('Recipe ID must be a string'),
  body('customMealName')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Custom meal name must be under 200 characters'),
  body('notes')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Notes must be under 500 characters'),
]

// ── GET /api/meal-plans/week ─────────────
// Must be before /:id to avoid param conflict
router.get(
  '/week',
  authenticate,
  [
    query('date')
      .optional()
      .isISO8601().withMessage('date must be a valid ISO date'),
  ],
  validate,
  mealPlanController.getWeekView.bind(mealPlanController)
)

// ── POST /api/meal-plans ─────────────────
router.post(
  '/',
  authenticate,
  [
    body('weekStartDate')
      .notEmpty().withMessage('weekStartDate is required')
      .isISO8601().withMessage('weekStartDate must be a valid ISO date'),
    body('items')
      .optional()
      .isArray().withMessage('items must be an array'),
    // Validate nested items if provided
    body('items.*.date')
      .optional()
      .isISO8601().withMessage('Each item date must be a valid ISO date'),
    body('items.*.mealType')
      .optional()
      .isIn(VALID_MEAL_TYPES).withMessage(`Each item mealType must be one of: ${VALID_MEAL_TYPES.join(', ')}`),
  ],
  validate,
  mealPlanController.createMealPlan.bind(mealPlanController)
)

// ── POST /api/meal-plans/:id/items ───────
router.post(
  '/:id/items',
  authenticate,
  [
    param('id').notEmpty().withMessage('Meal plan ID is required'),
    ...mealItemValidation,
  ],
  validate,
  mealPlanController.addMealItem.bind(mealPlanController)
)

// ── PUT /api/meal-plans/items/:itemId ────
router.put(
  '/items/:itemId',
  authenticate,
  [
    param('itemId').notEmpty().withMessage('Item ID is required'),
    body('date')
      .optional()
      .isISO8601().withMessage('Date must be a valid ISO date'),
    body('mealType')
      .optional()
      .isIn(VALID_MEAL_TYPES).withMessage(`Meal type must be one of: ${VALID_MEAL_TYPES.join(', ')}`),
    body('recipeId')
      .optional({ nullable: true })
      .isString(),
    body('customMealName')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 200 }),
    body('notes')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 500 }),
  ],
  validate,
  mealPlanController.updateMealItem.bind(mealPlanController)
)

// ── DELETE /api/meal-plans/items/:itemId ─
router.delete(
  '/items/:itemId',
  authenticate,
  [param('itemId').notEmpty().withMessage('Item ID is required')],
  validate,
  mealPlanController.deleteMealItem.bind(mealPlanController)
)

// ── DELETE /api/meal-plans/:id ───────────
router.delete(
  '/:id',
  authenticate,
  [param('id').notEmpty().withMessage('Meal plan ID is required')],
  validate,
  mealPlanController.deleteMealPlan.bind(mealPlanController)
)

export default router
