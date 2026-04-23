import prisma from '../lib/prisma'
import { NotificationType } from '@prisma/client'

const notificationRepository = {
  async getForUser(userId: string, limit = 20) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  },

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false },
    })
  },

  async create(userId: string, type: NotificationType, title: string, message: string, href?: string) {
    return prisma.notification.create({
      data: { userId, type, title, message, href },
    })
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  },

  async markOneRead(id: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    })
  },

  async hasAchievement(userId: string, achievementKey: string): Promise<boolean> {
    const row = await prisma.userAchievement.findUnique({
      where: { userId_achievementKey: { userId, achievementKey } },
    })
    return row !== null
  },

  async createAchievement(userId: string, achievementKey: string) {
    return prisma.userAchievement.create({
      data: { userId, achievementKey },
    })
  },

  async getUserAchievements(userId: string) {
    return prisma.userAchievement.findMany({
      where: { userId },
      orderBy: { unlockedAt: 'desc' },
    })
  },
}

export default notificationRepository
