// ─────────────────────────────────────────
// Health Service
//
// Business logic for health tracking:
// - Weight trend calculations
// - Nutrition averages
// - Ownership checks
// - Input validation
// ─────────────────────────────────────────

import healthRepository from '../repositories/health.repository'
import {
  LogWeightDTO,
  LogNutritionDTO,
  UpdateNutritionDTO,
  HealthQueryDTO,
  WeightLogResponse,
  NutritionLogResponse,
  WeightTrend,
  NutritionSummary,
} from '../types/health.types'

export class HealthService {
  // ── Helpers ──────────────────────────────

  private sanitizeWeight(log: any): WeightLogResponse {
    return {
      ...log,
      weightKg: Number(log.weightKg),
    }
  }

  private sanitizeNutrition(log: any): NutritionLogResponse {
    return { ...log }
  }

  /**
   * Calculate average of an array of numbers
   * Ignores null values
   */
  private average(values: (number | null)[]): number | null {
    const valid = values.filter((v): v is number => v !== null)
    if (valid.length === 0) return null
    return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
  }

  /**
   * Calculate weight trend stats from a list of logs
   */
  private calculateWeightStats(logs: WeightLogResponse[]) {
    if (logs.length === 0) {
      return {
        current: null,
        starting: null,
        lowest: null,
        highest: null,
        totalChange: null,
        averagePerWeek: null,
      }
    }

    const weights = logs.map((l) => l.weightKg)
    const current = weights[weights.length - 1]
    const starting = weights[0]
    const lowest = Math.min(...weights)
    const highest = Math.max(...weights)
    const totalChange = Number((current - starting).toFixed(2))

    // Calculate average weekly change
    let averagePerWeek: number | null = null
    if (logs.length >= 2) {
      const firstDate = new Date(logs[0].logDate)
      const lastDate = new Date(logs[logs.length - 1].logDate)
      const weeks =
        (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7)
      if (weeks > 0) {
        averagePerWeek = Number((totalChange / weeks).toFixed(2))
      }
    }

    return { current, starting, lowest, highest, totalChange, averagePerWeek }
  }

  // ── Weight Log Methods ───────────────────

  /**
   * GET WEIGHT LOGS WITH TREND
   * Returns logs and computed trend stats for charts
   */
  async getWeightLogs(
    userId: string,
    query: HealthQueryDTO
  ): Promise<WeightTrend> {
    if (query.from && isNaN(new Date(query.from).getTime())) {
      throw new Error('Invalid from date')
    }
    if (query.to && isNaN(new Date(query.to).getTime())) {
      throw new Error('Invalid to date')
    }

    const logs = await healthRepository.findWeightLogs(userId, query)
    const sanitized = logs.map(this.sanitizeWeight)

    return {
      logs: sanitized,
      stats: this.calculateWeightStats(sanitized),
    }
  }

  /**
   * LOG WEIGHT
   * Upserts — one log per day. Logging again on the same
   * day updates the existing entry.
   */
  async logWeight(
    userId: string,
    data: LogWeightDTO
  ): Promise<WeightLogResponse> {
    if (isNaN(new Date(data.logDate).getTime())) {
      throw new Error('Invalid logDate')
    }

    if (data.weightKg <= 0 || data.weightKg > 700) {
      throw new Error('Weight must be between 0 and 700 kg')
    }

    // Round to 2 decimal places
    const rounded = Math.round(data.weightKg * 100) / 100

    const log = await healthRepository.upsertWeightLog(userId, {
      ...data,
      weightKg: rounded,
    })

    return this.sanitizeWeight(log)
  }

  /**
   * DELETE WEIGHT LOG
   */
  async deleteWeightLog(userId: string, logId: string): Promise<void> {
    const isOwner = await healthRepository.isWeightLogOwner(logId, userId)
    if (!isOwner) throw new Error('Weight log not found or access denied')

    await healthRepository.deleteWeightLog(logId)
  }

  // ── Nutrition Log Methods ────────────────

  /**
   * GET NUTRITION LOGS WITH SUMMARY
   * Returns logs, 7-day averages, and today's log
   */
  async getNutritionLogs(
    userId: string,
    query: HealthQueryDTO
  ): Promise<NutritionSummary> {
    if (query.from && isNaN(new Date(query.from).getTime())) {
      throw new Error('Invalid from date')
    }
    if (query.to && isNaN(new Date(query.to).getTime())) {
      throw new Error('Invalid to date')
    }

    const [logs, todayLog] = await Promise.all([
      healthRepository.findNutritionLogs(userId, query),
      healthRepository.findTodayNutritionLog(userId),
    ])

    const sanitized = logs.map(this.sanitizeNutrition)
    const today = todayLog ? this.sanitizeNutrition(todayLog) : null

    return {
      logs: sanitized,
      averages: {
        calories: this.average(sanitized.map((l) => l.calories)),
        protein: this.average(sanitized.map((l) => l.protein)),
        carbs: this.average(sanitized.map((l) => l.carbs)),
        fat: this.average(sanitized.map((l) => l.fat)),
      },
      today,
    }
  }

  /**
   * LOG NUTRITION
   * Upserts — one log per day. Logging again updates
   * the existing entry for that day.
   */
  async logNutrition(
    userId: string,
    data: LogNutritionDTO
  ): Promise<NutritionLogResponse> {
    if (isNaN(new Date(data.date).getTime())) {
      throw new Error('Invalid date')
    }

    // Validate nutrition values are non-negative
    const fields = ['calories', 'protein', 'carbs', 'fat'] as const
    for (const field of fields) {
      if (data[field] !== undefined && data[field]! < 0) {
        throw new Error(`${field} cannot be negative`)
      }
    }

    const log = await healthRepository.upsertNutritionLog(userId, data)
    return this.sanitizeNutrition(log)
  }

  /**
   * DELETE NUTRITION LOG
   */
  async deleteNutritionLog(userId: string, logId: string): Promise<void> {
    const isOwner = await healthRepository.isNutritionLogOwner(logId, userId)
    if (!isOwner) throw new Error('Nutrition log not found or access denied')

    await healthRepository.deleteNutritionLog(logId)
  }
}

export default new HealthService()
