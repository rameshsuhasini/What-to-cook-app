// ─────────────────────────────────────────
// Health Repository
//
// All DB operations for weight logs and
// nutrition logs live here.
// ─────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { LogWeightDTO, LogNutritionDTO, UpdateNutritionDTO, HealthQueryDTO } from '../types/health.types'

// ── Selects ──────────────────────────────

const weightLogSelect = {
  id: true,
  userId: true,
  weightKg: true,
  logDate: true,
  createdAt: true,
}

const nutritionLogSelect = {
  id: true,
  userId: true,
  date: true,
  calories: true,
  protein: true,
  carbs: true,
  fat: true,
  createdAt: true,
  updatedAt: true,
}

export class HealthRepository {
  // ── Weight Logs ──────────────────────────

  /**
   * Get weight logs for a user within a date range
   */
  async findWeightLogs(userId: string, query: HealthQueryDTO) {
    const { from, to, limit = 90 } = query

    return prisma.weightLog.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              logDate: {
                ...(from && { gte: new Date(from) }),
                ...(to && { lte: new Date(to) }),
              },
            }
          : {}),
      },
      select: weightLogSelect,
      orderBy: { logDate: 'asc' },
      take: Math.min(limit, 365), // cap at 1 year
    })
  }

  /**
   * Find a weight log by date for a user
   * Used to prevent duplicate logs on the same day
   */
  async findWeightLogByDate(userId: string, logDate: Date) {
    return prisma.weightLog.findUnique({
      where: { userId_logDate: { userId, logDate } },
      select: weightLogSelect,
    })
  }

  /**
   * Create or update a weight log for a specific date
   * Upsert — only one log per day per user
   */
  async upsertWeightLog(userId: string, data: LogWeightDTO) {
    const logDate = new Date(data.logDate)

    return prisma.weightLog.upsert({
      where: { userId_logDate: { userId, logDate } },
      update: { weightKg: data.weightKg },
      create: { userId, weightKg: data.weightKg, logDate },
      select: weightLogSelect,
    })
  }

  /**
   * Delete a weight log by ID
   */
  async deleteWeightLog(id: string): Promise<void> {
    await prisma.weightLog.delete({ where: { id } })
  }

  /**
   * Check if a weight log belongs to a user
   */
  async isWeightLogOwner(id: string, userId: string): Promise<boolean> {
    const log = await prisma.weightLog.findUnique({
      where: { id },
      select: { userId: true },
    })
    return log?.userId === userId
  }

  // ── Nutrition Logs ───────────────────────

  /**
   * Get nutrition logs for a user within a date range
   */
  async findNutritionLogs(userId: string, query: HealthQueryDTO) {
    const { from, to, limit = 30 } = query

    return prisma.nutritionLog.findMany({
      where: {
        userId,
        ...(from || to
          ? {
              date: {
                ...(from && { gte: new Date(from) }),
                ...(to && { lte: new Date(to) }),
              },
            }
          : {}),
      },
      select: nutritionLogSelect,
      orderBy: { date: 'asc' },
      take: Math.min(limit, 365),
    })
  }

  /**
   * Find today's nutrition log for a user
   */
  async findTodayNutritionLog(userId: string) {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    return prisma.nutritionLog.findUnique({
      where: { userId_date: { userId, date: today } },
      select: nutritionLogSelect,
    })
  }

  /**
   * Create or update a nutrition log for a specific date
   * Upsert — only one log per day per user
   */
  async upsertNutritionLog(userId: string, data: LogNutritionDTO) {
    const date = new Date(data.date)
    date.setUTCHours(0, 0, 0, 0)

    return prisma.nutritionLog.upsert({
      where: { userId_date: { userId, date } },
      update: {
        ...(data.calories !== undefined && { calories: data.calories }),
        ...(data.protein !== undefined && { protein: data.protein }),
        ...(data.carbs !== undefined && { carbs: data.carbs }),
        ...(data.fat !== undefined && { fat: data.fat }),
      },
      create: {
        userId,
        date,
        calories: data.calories ?? null,
        protein: data.protein ?? null,
        carbs: data.carbs ?? null,
        fat: data.fat ?? null,
      },
      select: nutritionLogSelect,
    })
  }

  /**
   * Delete a nutrition log by ID
   */
  async deleteNutritionLog(id: string): Promise<void> {
    await prisma.nutritionLog.delete({ where: { id } })
  }

  /**
   * Check if a nutrition log belongs to a user
   */
  async isNutritionLogOwner(id: string, userId: string): Promise<boolean> {
    const log = await prisma.nutritionLog.findUnique({
      where: { id },
      select: { userId: true },
    })
    return log?.userId === userId
  }
}

export default new HealthRepository()
