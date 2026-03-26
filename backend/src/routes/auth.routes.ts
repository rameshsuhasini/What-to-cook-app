// ─────────────────────────────────────────
// Auth Routes
//
// Routes are just a mapping of:
// HTTP Method + URL → Middleware → Controller
//
// Validation rules are defined here and
// passed through the validate middleware
// before hitting the controller
// ─────────────────────────────────────────

import { Router } from 'express'
import { body } from 'express-validator'
import authController from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

// ── Signup ──────────────────────────────
router.post(
  '/signup',
  [
    body('name')
      .trim()
      .notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required')
      .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain uppercase, lowercase and a number'),
  ],
  validate,
  authController.signup.bind(authController)
)

// ── Login ───────────────────────────────
router.post(
  '/login',
  [
    body('email')
      .trim()
      .notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email address')
      .normalizeEmail(),
    body('password')
      .notEmpty().withMessage('Password is required'),
  ],
  validate,
  authController.login.bind(authController)
)

// ── Logout ──────────────────────────────
router.post('/logout', authController.logout.bind(authController))

// ── Get Current User ────────────────────
router.get(
  '/me',
  authenticate,
  authController.getMe.bind(authController)
)

export default router