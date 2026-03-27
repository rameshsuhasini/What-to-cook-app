// ─────────────────────────────────────────
// Grocery Routes
//
// IMPORTANT route ordering:
// /generate and /item/:itemId must be
// registered before /:id to avoid Express
// treating "generate" or "item" as an :id
// ─────────────────────────────────────────

import { Router } from 'express'
import { body, param } from 'express-validator'
import groceryController from '../controllers/grocery.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

// ── GET /api/groceries ───────────────────
router.get(
  '/',
  authenticate,
  groceryController.getGroceryList.bind(groceryController)
)

// ── POST /api/groceries/generate ────────
// Must be before /:id
router.post(
  '/generate',
  authenticate,
  [
    body('mealPlanId')
      .notEmpty().withMessage('mealPlanId is required')
      .isString().withMessage('mealPlanId must be a string'),
  ],
  validate,
  groceryController.generateGroceryList.bind(groceryController)
)

// ── PUT /api/groceries/item/:itemId ─────
// Must be before /:id
router.put(
  '/item/:itemId',
  authenticate,
  [
    param('itemId').notEmpty().withMessage('Item ID is required'),
    body('ingredientName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 }).withMessage('Name must be 1–200 characters'),
    body('quantity')
      .optional({ nullable: true })
      .isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 50 }).withMessage('Unit must be under 50 characters'),
    body('category')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 100 }).withMessage('Category must be under 100 characters'),
    body('isChecked')
      .optional()
      .isBoolean().withMessage('isChecked must be a boolean'),
  ],
  validate,
  groceryController.updateItem.bind(groceryController)
)

// ── DELETE /api/groceries/item/:itemId ──
// Must be before /:id
router.delete(
  '/item/:itemId',
  authenticate,
  [param('itemId').notEmpty().withMessage('Item ID is required')],
  validate,
  groceryController.deleteItem.bind(groceryController)
)

// ── GET /api/groceries/:id ───────────────
router.get(
  '/:id',
  authenticate,
  [param('id').notEmpty().withMessage('List ID is required')],
  validate,
  groceryController.getGroceryListById.bind(groceryController)
)

// ── POST /api/groceries/:id/items ───────
router.post(
  '/:id/items',
  authenticate,
  [
    param('id').notEmpty().withMessage('List ID is required'),
    body('ingredientName')
      .trim()
      .notEmpty().withMessage('Ingredient name is required')
      .isLength({ max: 200 }).withMessage('Name must be under 200 characters'),
    body('quantity')
      .optional()
      .isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('unit')
      .optional()
      .trim()
      .isLength({ max: 50 }).withMessage('Unit must be under 50 characters'),
    body('category')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Category must be under 100 characters'),
  ],
  validate,
  groceryController.addItem.bind(groceryController)
)

// ── PUT /api/groceries/:id/check-all ────
router.put(
  '/:id/check-all',
  authenticate,
  [
    param('id').notEmpty().withMessage('List ID is required'),
    body('isChecked')
      .isBoolean().withMessage('isChecked must be true or false'),
  ],
  validate,
  groceryController.checkAllItems.bind(groceryController)
)

export default router
