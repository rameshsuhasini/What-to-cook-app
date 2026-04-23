// ─────────────────────────────────────────
// Recipe Routes
//
// Routes map HTTP Method + URL → Middleware
// → Controller.
//
// IMPORTANT: /saved and /save must be
// registered BEFORE /:id to prevent Express
// treating "saved" as a route param.
// ─────────────────────────────────────────

import { Router, Request, Response, NextFunction } from 'express'
import { body, param, query } from 'express-validator'
import recipeController from '../controllers/recipe.controller'
import recipeImportController from '../controllers/recipeImport.controller'
import { authenticate, optionalAuthenticate} from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

// ── Rate limiter for import endpoint (10 per 10 min per user) ──
const importRateLimitStore = new Map<string, { count: number; resetAt: number }>()
const importRateLimit = (req: Request, res: Response, next: NextFunction): void => {
  const userId = req.user?.userId
  if (!userId) { next(); return }
  const now = Date.now()
  const windowMs = 10 * 60 * 1000
  const entry = importRateLimitStore.get(userId)
  if (!entry || now > entry.resetAt) {
    importRateLimitStore.set(userId, { count: 1, resetAt: now + windowMs })
    next(); return
  }
  if (entry.count >= 10) {
    res.status(429).json({ success: false, message: 'Too many import requests. Please wait a few minutes.' })
    return
  }
  entry.count++
  next()
}

// ── Ingredient validation (reused in create + update) ──
const ingredientValidation = body('ingredients')
  .isArray({ min: 1 })
  .withMessage('At least one ingredient is required')

const ingredientNameValidation = body('ingredients.*.ingredientName')
  .trim()
  .notEmpty()
  .withMessage('Each ingredient must have a name')
  .isLength({ max: 200 })
  .withMessage('Ingredient name must be under 200 characters')

const ingredientQuantityValidation = body('ingredients.*.quantity')
  .optional()
  .isFloat({ min: 0 })
  .withMessage('Quantity must be a positive number')

const ingredientUnitValidation = body('ingredients.*.unit')
  .optional()
  .trim()
  .isLength({ max: 50 })
  .withMessage('Unit must be under 50 characters')

// ── Step validation (reused in create + update) ──
const stepValidation = body('steps')
  .isArray({ min: 1 })
  .withMessage('At least one step is required')

const stepNumberValidation = body('steps.*.stepNumber')
  .isInt({ min: 1 })
  .withMessage('Step number must be a positive integer')

const stepTextValidation = body('steps.*.instructionText')
  .trim()
  .notEmpty()
  .withMessage('Each step must have instruction text')
  .isLength({ max: 2000 })
  .withMessage('Instruction text must be under 2000 characters')

// ── GET /api/recipes ─────────────────────
router.get(
  '/',
  optionalAuthenticate,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be 1–50'),
    query('search').optional().trim().isLength({ max: 200 }).withMessage('Search too long'),
    query('dietType')
      .optional()
      .isIn(['NONE','VEGETARIAN','VEGAN','KETO','PALEO','GLUTEN_FREE','DAIRY_FREE','HALAL','KOSHER'])
      .withMessage('Invalid diet type'),
    query('maxCalories').optional().isInt({ min: 0 }).withMessage('maxCalories must be positive'),
    query('minProtein').optional().isInt({ min: 0 }).withMessage('minProtein must be positive'),
  ],
  validate,
  recipeController.getRecipes.bind(recipeController)
)

// ── POST /api/recipes/import-url ─────────
// Must be before /:id — "import-url" would be treated as an :id param otherwise
router.post(
  '/import-url',
  authenticate,
  importRateLimit,
  [
    body('url')
      .trim()
      .notEmpty().withMessage('URL is required')
      .isURL({ require_protocol: true }).withMessage('Please provide a valid URL including http:// or https://'),
  ],
  validate,
  recipeImportController.importFromUrl.bind(recipeImportController)
)

// ── GET /api/recipes/saved ───────────────
// Must be before /:id — "saved" would be
// treated as an :id param otherwise
router.get(
  '/saved',
  authenticate,
  recipeController.getSavedRecipes.bind(recipeController)
)

// ── GET /api/recipes/:id ─────────────────
router.get(
  '/:id',
  optionalAuthenticate,
  [param('id').notEmpty().withMessage('Recipe ID is required')],
  validate,
  recipeController.getRecipeById.bind(recipeController)
)

// ── POST /api/recipes ────────────────────
router.post(
  '/',
  authenticate,
  [
    body('title')
      .trim()
      .notEmpty().withMessage('Title is required')
      .isLength({ min: 2, max: 200 }).withMessage('Title must be 2–200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Description must be under 2000 characters'),
    body('prepTimeMinutes')
      .optional()
      .isInt({ min: 0 }).withMessage('Prep time must be a positive number'),
    body('cookTimeMinutes')
      .optional()
      .isInt({ min: 0 }).withMessage('Cook time must be a positive number'),
    body('servings')
      .optional()
      .isInt({ min: 1 }).withMessage('Servings must be at least 1'),
    body('calories')
      .optional()
      .isInt({ min: 0 }).withMessage('Calories must be a positive number'),
    body('protein')
      .optional()
      .isInt({ min: 0 }).withMessage('Protein must be a positive number'),
    body('carbs')
      .optional()
      .isInt({ min: 0 }).withMessage('Carbs must be a positive number'),
    body('fat')
      .optional()
      .isInt({ min: 0 }).withMessage('Fat must be a positive number'),
    body('cuisine')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Cuisine must be under 100 characters'),
    body('dietType')
      .optional()
      .isIn(['NONE','VEGETARIAN','VEGAN','KETO','PALEO','GLUTEN_FREE','DAIRY_FREE','HALAL','KOSHER'])
      .withMessage('Invalid diet type'),
    ingredientValidation,
    ingredientNameValidation,
    ingredientQuantityValidation,
    ingredientUnitValidation,
    stepValidation,
    stepNumberValidation,
    stepTextValidation,
  ],
  validate,
  recipeController.createRecipe.bind(recipeController)
)

// ── POST /api/recipes/save ───────────────
router.post(
  '/save',
  authenticate,
  [
    body('recipeId')
      .notEmpty().withMessage('Recipe ID is required'),
  ],
  validate,
  recipeController.saveRecipe.bind(recipeController)
)

// ── PUT /api/recipes/:id ─────────────────
router.put(
  '/:id',
  authenticate,
  [
    param('id').notEmpty().withMessage('Recipe ID is required'),
    body('title')
      .optional()
      .trim()
      .isLength({ min: 2, max: 200 }).withMessage('Title must be 2–200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 2000 }).withMessage('Description must be under 2000 characters'),
    body('prepTimeMinutes')
      .optional()
      .isInt({ min: 0 }).withMessage('Prep time must be a positive number'),
    body('cookTimeMinutes')
      .optional()
      .isInt({ min: 0 }).withMessage('Cook time must be a positive number'),
    body('servings')
      .optional()
      .isInt({ min: 1 }).withMessage('Servings must be at least 1'),
    body('calories')
      .optional()
      .isInt({ min: 0 }).withMessage('Calories must be a positive number'),
    body('protein')
      .optional()
      .isInt({ min: 0 }).withMessage('Protein must be a positive number'),
    body('carbs')
      .optional()
      .isInt({ min: 0 }).withMessage('Carbs must be a positive number'),
    body('fat')
      .optional()
      .isInt({ min: 0 }).withMessage('Fat must be a positive number'),
    body('cuisine')
      .optional()
      .trim()
      .isLength({ max: 100 }).withMessage('Cuisine must be under 100 characters'),
    body('dietType')
      .optional()
      .isIn(['NONE','VEGETARIAN','VEGAN','KETO','PALEO','GLUTEN_FREE','DAIRY_FREE','HALAL','KOSHER'])
      .withMessage('Invalid diet type'),
    body('ingredients').optional().isArray({ min: 1 }).withMessage('At least one ingredient required'),
    ingredientNameValidation,
    ingredientQuantityValidation,
    ingredientUnitValidation,
    body('steps').optional().isArray({ min: 1 }).withMessage('At least one step required'),
    stepNumberValidation,
    stepTextValidation,
  ],
  validate,
  recipeController.updateRecipe.bind(recipeController)
)

// ── DELETE /api/recipes/save/:id ─────────
router.delete(
  '/save/:id',
  authenticate,
  [param('id').notEmpty().withMessage('Recipe ID is required')],
  validate,
  recipeController.unsaveRecipe.bind(recipeController)
)

// ── DELETE /api/recipes/:id ──────────────
router.delete(
  '/:id',
  authenticate,
  [param('id').notEmpty().withMessage('Recipe ID is required')],
  validate,
  recipeController.deleteRecipe.bind(recipeController)
)

export default router
