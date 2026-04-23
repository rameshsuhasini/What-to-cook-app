import { Request, Response, NextFunction } from 'express'
import notificationRepository from '../repositories/notification.repository'
import { reminderService } from '../services/reminder.service'
import { ACHIEVEMENT_MAP } from '../lib/achievements'

class NotificationController {
  async getNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId

      await reminderService.checkAndCreateReminders(userId)

      const [notifications, unreadCount, userAchievements] = await Promise.all([
        notificationRepository.getForUser(userId),
        notificationRepository.getUnreadCount(userId),
        notificationRepository.getUserAchievements(userId),
      ])

      // Attach achievement definition metadata (emoji, etc.) to each unlocked achievement
      const achievements = userAchievements.map((ua) => ({
        ...ua,
        definition: ACHIEVEMENT_MAP.get(ua.achievementKey) ?? null,
      }))

      res.json({
        success: true,
        data: { notifications, unreadCount, achievements },
      })
    } catch (err) {
      next(err)
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      await notificationRepository.markAllRead(userId)
      res.json({ success: true, data: {} })
    } catch (err) {
      next(err)
    }
  }

  async markOneRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId
      const id = req.params.id as string
      await notificationRepository.markOneRead(id, userId)
      res.json({ success: true, data: {} })
    } catch (err) {
      next(err)
    }
  }
}

export default new NotificationController()
