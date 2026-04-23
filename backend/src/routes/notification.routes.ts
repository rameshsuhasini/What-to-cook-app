import { Router } from 'express'
import { param } from 'express-validator'
import notificationController from '../controllers/notification.controller'
import { authenticate } from '../middleware/auth.middleware'
import { validate } from '../middleware/validate.middleware'

const router = Router()

// GET /api/notifications
router.get('/', authenticate, notificationController.getNotifications.bind(notificationController))

// PUT /api/notifications/read  — mark all read
router.put('/read', authenticate, notificationController.markAllRead.bind(notificationController))

// PUT /api/notifications/:id/read  — mark one read
router.put(
  '/:id/read',
  authenticate,
  [param('id').notEmpty().withMessage('Notification ID is required')],
  validate,
  notificationController.markOneRead.bind(notificationController)
)

export default router
