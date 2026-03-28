// ─────────────────────────────────────────
// Health Service Tests
// ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import healthService from '../services/health.service'
import healthRepository from '../repositories/health.repository'

vi.mock('../repositories/health.repository', () => ({
  default: {
    findWeightLogs: vi.fn(),
    findWeightLogByDate: vi.fn(),
    upsertWeightLog: vi.fn(),
    deleteWeightLog: vi.fn(),
    isWeightLogOwner: vi.fn(),
    findNutritionLogs: vi.fn(),
    findTodayNutritionLog: vi.fn(),
    upsertNutritionLog: vi.fn(),
    deleteNutritionLog: vi.fn(),
    isNutritionLogOwner: vi.fn(),
  },
}))

const mockWeightLog = {
  id: 'log-1',
  userId: 'user-1',
  weightKg: 75.5,
  logDate: new Date('2024-01-15'),
  createdAt: new Date(),
}

const mockNutritionLog = {
  id: 'nlog-1',
  userId: 'user-1',
  date: new Date('2024-01-15'),
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 70,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('HealthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getWeightLogs ────────────────────────

  describe('getWeightLogs', () => {
    it('returns logs with null stats when no logs exist', async () => {
      vi.mocked(healthRepository.findWeightLogs).mockResolvedValue([])

      const result = await healthService.getWeightLogs('user-1', {})

      expect(result.logs).toHaveLength(0)
      expect(result.stats.current).toBeNull()
      expect(result.stats.starting).toBeNull()
      expect(result.stats.totalChange).toBeNull()
    })

    it('calculates correct trend stats from logs', async () => {
      const logs = [
        { ...mockWeightLog, weightKg: 80, logDate: new Date('2024-01-01') },
        { ...mockWeightLog, id: 'log-2', weightKg: 78, logDate: new Date('2024-01-08') },
        { ...mockWeightLog, id: 'log-3', weightKg: 76, logDate: new Date('2024-01-15') },
      ]
      vi.mocked(healthRepository.findWeightLogs).mockResolvedValue(logs as any)

      const result = await healthService.getWeightLogs('user-1', {})

      expect(result.stats.current).toBe(76)
      expect(result.stats.starting).toBe(80)
      expect(result.stats.lowest).toBe(76)
      expect(result.stats.highest).toBe(80)
      expect(result.stats.totalChange).toBe(-4)
      expect(result.stats.averagePerWeek).toBeDefined()
    })

    it('throws on invalid from date', async () => {
      await expect(
        healthService.getWeightLogs('user-1', { from: 'not-a-date' })
      ).rejects.toThrow('Invalid from date')
    })
  })

  // ── logWeight ────────────────────────────

  describe('logWeight', () => {
    it('logs weight successfully', async () => {
      vi.mocked(healthRepository.upsertWeightLog).mockResolvedValue(mockWeightLog as any)

      const result = await healthService.logWeight('user-1', {
        weightKg: 75.5,
        logDate: '2024-01-15',
      })

      expect(result.weightKg).toBe(75.5)
    })

    it('rounds weight to 2 decimal places', async () => {
      vi.mocked(healthRepository.upsertWeightLog).mockResolvedValue(mockWeightLog as any)

      await healthService.logWeight('user-1', {
        weightKg: 75.555,
        logDate: '2024-01-15',
      })

      expect(healthRepository.upsertWeightLog).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ weightKg: 75.56 })
      )
    })

    it('throws when weight is zero or negative', async () => {
      await expect(
        healthService.logWeight('user-1', { weightKg: 0, logDate: '2024-01-15' })
      ).rejects.toThrow('between 0 and 700')
    })

    it('throws when weight exceeds 700kg', async () => {
      await expect(
        healthService.logWeight('user-1', { weightKg: 701, logDate: '2024-01-15' })
      ).rejects.toThrow('between 0 and 700')
    })

    it('throws on invalid date', async () => {
      await expect(
        healthService.logWeight('user-1', { weightKg: 75, logDate: 'bad-date' })
      ).rejects.toThrow('Invalid logDate')
    })
  })

  // ── deleteWeightLog ──────────────────────

  describe('deleteWeightLog', () => {
    it('deletes when user is owner', async () => {
      vi.mocked(healthRepository.isWeightLogOwner).mockResolvedValue(true)
      vi.mocked(healthRepository.deleteWeightLog).mockResolvedValue()

      await expect(
        healthService.deleteWeightLog('user-1', 'log-1')
      ).resolves.toBeUndefined()
    })

    it('throws when user is not owner', async () => {
      vi.mocked(healthRepository.isWeightLogOwner).mockResolvedValue(false)

      await expect(
        healthService.deleteWeightLog('user-2', 'log-1')
      ).rejects.toThrow('access denied')
    })
  })

  // ── getNutritionLogs ─────────────────────

  describe('getNutritionLogs', () => {
    it('returns logs with averages and today', async () => {
      vi.mocked(healthRepository.findNutritionLogs).mockResolvedValue([
        mockNutritionLog,
        { ...mockNutritionLog, id: 'nlog-2', calories: 1800, protein: 130 },
      ] as any)
      vi.mocked(healthRepository.findTodayNutritionLog).mockResolvedValue(
        mockNutritionLog as any
      )

      const result = await healthService.getNutritionLogs('user-1', {})

      expect(result.logs).toHaveLength(2)
      expect(result.averages.calories).toBe(1900) // (2000+1800)/2
      expect(result.averages.protein).toBe(140)   // (150+130)/2
      expect(result.today).not.toBeNull()
      expect(result.today!.id).toBe('nlog-1')
    })

    it('returns null averages when no logs', async () => {
      vi.mocked(healthRepository.findNutritionLogs).mockResolvedValue([])
      vi.mocked(healthRepository.findTodayNutritionLog).mockResolvedValue(null)

      const result = await healthService.getNutritionLogs('user-1', {})

      expect(result.averages.calories).toBeNull()
      expect(result.today).toBeNull()
    })
  })

  // ── logNutrition ─────────────────────────

  describe('logNutrition', () => {
    it('logs nutrition successfully', async () => {
      vi.mocked(healthRepository.upsertNutritionLog).mockResolvedValue(
        mockNutritionLog as any
      )

      const result = await healthService.logNutrition('user-1', {
        date: '2024-01-15',
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 70,
      })

      expect(result.calories).toBe(2000)
    })

    it('throws when calories are negative', async () => {
      await expect(
        healthService.logNutrition('user-1', {
          date: '2024-01-15',
          calories: -100,
        })
      ).rejects.toThrow('cannot be negative')
    })

    it('throws on invalid date', async () => {
      await expect(
        healthService.logNutrition('user-1', { date: 'bad-date' })
      ).rejects.toThrow('Invalid date')
    })
  })
})
