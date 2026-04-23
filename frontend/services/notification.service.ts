import api from '@/lib/axios'

export type NotificationType = 'ACHIEVEMENT' | 'REMINDER' | 'MOTIVATION'

export interface AppNotification {
  id: string
  userId: string
  type: NotificationType
  title: string
  message: string
  href: string | null
  isRead: boolean
  createdAt: string
}

export interface AchievementDefinition {
  key: string
  title: string
  message: string
  emoji: string
}

export interface UserAchievement {
  id: string
  userId: string
  achievementKey: string
  unlockedAt: string
  definition: AchievementDefinition | null
}

export interface NotificationsResponse {
  notifications: AppNotification[]
  unreadCount: number
  achievements: UserAchievement[]
}

export const notificationApi = {
  getNotifications: async (): Promise<NotificationsResponse> => {
    const res = await api.get('/notifications')
    return res.data.data
  },

  markAllRead: async (): Promise<void> => {
    await api.put('/notifications/read')
  },

  markOneRead: async (id: string): Promise<void> => {
    await api.put(`/notifications/${id}/read`)
  },
}

// ── Motivation messages ───────────────────────────────────
// Randomly shown on dashboard — no DB needed.

export const MOTIVATION_MESSAGES = [
  "Abs are made in the kitchen. Or so they say. 🥗",
  "You're one meal plan away from feeling unstoppable. 💪",
  "Your future self is already proud of you. 🌟",
  "Meal prepping: the superpower nobody talks about. 🦸",
  "A little planning today = a lot less stress tomorrow. 📅",
  "You didn't come this far to only come this far. 🔥",
  "Eating well is a form of self-respect. Respect yourself! ❤️",
  "Progress, not perfection. Every logged meal counts. ✅",
  "The secret ingredient is always a little consistency. 🧂",
  "Your pantry called. It wants to be used. 🧺",
  "Small steps. Big results. Keep going! 🚀",
  "Hydration check: have you had water today? 💧",
  "Cooking at home > takeout. Your wallet agrees. 💸",
  "One more logged meal and you're basically a dietitian. 🥦",
  "The best time to start healthy eating was yesterday. Second best? Right now. ⏰",
  "Plot twist: vegetables are actually delicious. 🥕",
  "Your meal plan isn't going to build itself. But we can help. 😉",
  "Champions eat breakfast. Are you a champion? 🏆",
  "You've got this. Even if 'this' is just logging your lunch. 👊",
  "Protein: the hero your muscles deserve. 💪",
]

export function getRandomMotivation(): string {
  return MOTIVATION_MESSAGES[Math.floor(Math.random() * MOTIVATION_MESSAGES.length)]
}
