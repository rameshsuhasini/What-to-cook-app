import prisma from '../lib/prisma'
import notificationRepository from '../repositories/notification.repository'

const WEIGHT_REMINDER_DAYS = 7
const NUTRITION_REMINDER_DAYS = 1

export const reminderService = {
  // Called on GET /api/notifications — checks if reminders are needed and creates them.
  // Deduplicates by checking if an unread reminder of the same type already exists.
  async checkAndCreateReminders(userId: string): Promise<void> {
    await Promise.all([
      checkWeightReminder(userId),
      checkNutritionReminder(userId),
    ])
  },
}

async function checkWeightReminder(userId: string): Promise<void> {
  const latest = await prisma.weightLog.findFirst({
    where: { userId },
    orderBy: { logDate: 'desc' },
  })

  const daysSince = latest
    ? daysBetween(new Date(latest.logDate), new Date())
    : WEIGHT_REMINDER_DAYS + 1

  if (daysSince < WEIGHT_REMINDER_DAYS) return

  const alreadyPending = await prisma.notification.findFirst({
    where: { userId, type: 'REMINDER', isRead: false, title: 'Log your weight' },
  })
  if (alreadyPending) return

  await notificationRepository.create(
    userId,
    'REMINDER',
    'Log your weight',
    latest
      ? `It's been ${daysSince} days since your last weight entry. Stay on track! ⚖️`
      : "You haven't logged your weight yet. Start tracking your progress! ⚖️",
    '/progress?open=weight-log'
  )
}

async function checkNutritionReminder(userId: string): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayLog = await prisma.nutritionLog.findFirst({
    where: { userId, date: { gte: today } },
  })

  if (todayLog) return

  // Only remind after 6pm local-ish — proxy: skip if hour < 18 UTC
  const hourUtc = new Date().getUTCHours()
  if (hourUtc < 18) return

  const alreadyPending = await prisma.notification.findFirst({
    where: { userId, type: 'REMINDER', isRead: false, title: "Log today's nutrition" },
  })
  if (alreadyPending) return

  await notificationRepository.create(
    userId,
    'REMINDER',
    "Log today's nutrition",
    "You haven't logged your meals today. Keep your streak alive! 🥗",
    '/progress?open=nutrition-log'
  )
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
