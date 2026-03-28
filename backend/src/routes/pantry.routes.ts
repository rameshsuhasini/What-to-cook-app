// ─────────────────────────────────────────
// Pantry Routes
//
// IMPORTANT: /bulk and /clear must be
// registered BEFORE /:id to prevent Express
// treating them as route params.
// ─────────────────────────────────────────

import { Router } from 'express'
import { body, param, query } from 'express-validator'
import pantryController from '../controllers/pantry.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

// ── Shared item validation ───────────────
const itemNameValidation = body('ingredientName')
  .trim()
  .notEmpty().withMessage('Ingredient name is required')
  .isLength({ max: 200 }).withMessage('Name must be under 200 characters')

const itemQuantityValidation = body('quantity')
  .optional({ nullable: true })
  .isFloat({ min: 0 }).withMessage('Quantity must be a positive number')

const itemUnitValidation = body('unit')
  .optional({ nullable: true })
  .trim()
  .isLength({ max: 50 }).withMessage('Unit must be under 50 characters')

// ── GET /api/pantry ──────────────────────
router.get(
  '/',
  authenticate,
  [
    query('search').optional().trim().isLength({ max: 200 }),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be positive'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1–100'),
  ],
  validate,
  pantryController.getPantryItems.bind(pantryController)
)

// ── POST /api/pantry ─────────────────────
router.post(
  '/',
  authenticate,
  [itemNameValidation, itemQuantityValidation, itemUnitValidation],
  validate,
  pantryController.addPantryItem.bind(pantryController)
)

// ── POST /api/pantry/bulk ────────────────
// Must be before /:id
router.post(
  '/bulk',
  authenticate,
  [
    body('items')
      .isArray({ min: 1, max: 100 })
      .withMessage('items must be an array of 1–100 items'),
    body('items.*.ingredientName')
      .trim()
      .notEmpty().withMessage('Each item must have an ingredient name')
      .isLength({ max: 200 }).withMessage('Name must be under 200 characters'),
    body('items.*.quantity')
      .optional({ nullable: true })
      .isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
    body('items.*.unit')
      .optional({ nullable: true })
      .trim()
      .isLength({ max: 50 }).withMessage('Unit must be under 50 characters'),
  ],
  validate,
  pantryController.bulkAddPantryItems.bind(pantryController)
)

// ── DELETE /api/pantry/clear ─────────────
// Must be before /:id
router.delete(
  '/clear',
  authenticate,
  pantryController.clearPantry.bind(pantryController)
)

// ── PUT /api/pantry/:id ──────────────────
router.put(
  '/:id',
  authenticate,
  [
    param('id').notEmpty().withMessage('Item ID is required'),
    body('ingredientName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 200 }).withMessage('Name must be 1–200 characters'),
    itemQuantityValidation,
    itemUnitValidation,
  ],
  validate,
  pantryController.updatePantryItem.bind(pantryController)
)

// ── DELETE /api/pantry/:id ───────────────
router.delete(
  '/:id',
  authenticate,
  [param('id').notEmpty().withMessage('Item ID is required')],
  validate,
  pantryController.deletePantryItem.bind(pantryController)
)

export default router
