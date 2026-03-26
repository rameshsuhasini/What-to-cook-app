// ─────────────────────────────────────────
// Meal Plan Service Tests
// ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import mealPlanService from '../services/meal-plan.service'
import mealPlanRepository from '../repositories/meal-plan.repository'

vi.mock('../repositories/meal-plan.repository', () => ({
  default: {
    findByWeek: vi.fn(),
    findById: vi.fn(),
    findItemById: vi.fn(),
    create: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    delete: vi.fn(),
    isOwner: vi.fn(),
  },
}))

const mockMealPlan = {
  id: 'plan-1',
  userId: 'user-1',
  weekStartDate: new Date('2024-01-15'), // Monday
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [],
}

const mockItem = {
  id: 'item-1',
  mealPlanId: 'plan-1',
  date: new Date('2024-01-15'),
  mealType: 'BREAKFAST' as const,
  recipeId: 'recipe-1',
  customMealName: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  recipe: {
    id: 'recipe-1',
    title: 'Oatmeal',
    imageUrl: null,
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    calories: 300,
    servings: 1,
  },
  mealPlan: { userId: 'user-1', id: 'plan-1' },
}

describe('MealPlanService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getWeekView ──────────────────────────

  describe('getWeekView', () => {
    it('returns a 7-day week view with empty slots when no plan exists', async () => {
      vi.mocked(mealPlanRepository.findByWeek).mockResolvedValue(null)

      const result = await mealPlanService.getWeekView('user-1', '2024-01-17')

      expect(result.mealPlan).toBeNull()
      expect(result.days).toHaveLength(7)
      expect(result.weekStartDate).toBe('2024-01-15') // normalised to Monday
      expect(result.weekEndDate).toBe('2024-01-21')
      result.days.forEach((day) => {
        expect(day.breakfast).toBeNull()
        expect(day.lunch).toBeNull()
        expect(day.dinner).toBeNull()
        expect(day.snack).toBeNull()
      })
    })

    it('normalises any weekday to the Monday of that week', async () => {
      vi.mocked(mealPlanRepository.findByWeek).mockResolvedValue(null)

      // Wednesday → should resolve to Monday
      const result = await mealPlanService.getWeekView('user-1', '2024-01-17')
      expect(result.weekStartDate).toBe('2024-01-15')
    })

    it('normalises Sunday to the previous Monday', async () => {
      vi.mocked(mealPlanRepository.findByWeek).mockResolvedValue(null)

      // Sunday Jan 21 → Monday Jan 15
      const result = await mealPlanService.getWeekView('user-1', '2024-01-21')
      expect(result.weekStartDate).toBe('2024-01-15')
    })

    it('throws on invalid date', async () => {
      await expect(
        mealPlanService.getWeekView('user-1', 'not-a-date')
      ).rejects.toThrow('Invalid date')
    })

    it('returns meal plan with populated day slots', async () => {
      const planWithItems = {
        ...mockMealPlan,
        items: [mockItem],
      }
      vi.mocked(mealPlanRepository.findByWeek).mockResolvedValue(planWithItems as any)

      const result = await mealPlanService.getWeekView('user-1', '2024-01-15')

      expect(result.mealPlan).not.toBeNull()
      // Monday slot should have the breakfast item
      const monday = result.days.find((d) => d.date === '2024-01-15')
      expect(monday?.breakfast?.id).toBe('item-1')
    })
  })

  // ── createMealPlan ───────────────────────

  describe('createMealPlan', () => {
    it('creates a new meal plan normalised to Monday', async () => {
      vi.mocked(mealPlanRepository.findByWeek).mockResolvedValue(null)
      vi.mocked(mealPlanRepository.create).mockResolvedValue(mockMealPlan as any)

      await mealPlanService.createMealPlan('user-1', {
        weekStartDate: '2024-01-17', // Wednesday
      })

      // Should be called with Monday
      expect(mealPlanRepository.create).toHaveBeenCalledWith(
        'user-1',
        new Date('2024-01-15'),
        undefined
      )
    })

    it('returns existing plan if one already exists for the week', async () => {
      vi.mocked(mealPlanRepository.findByWeek).mockResolvedValue(mockMealPlan as any)

      const result = await mealPlanService.createMealPlan('user-1', {
        weekStartDate: '2024-01-15',
      })

      expect(mealPlanRepository.create).not.toHaveBeenCalled()
      expect(result.id).toBe('plan-1')
    })

    it('throws on invalid weekStartDate', async () => {
      await expect(
        mealPlanService.createMealPlan('user-1', { weekStartDate: 'bad-date' })
      ).rejects.toThrow('Invalid weekStartDate')
    })
  })

  // ── addMealItem ──────────────────────────

  describe('addMealItem', () => {
    it('adds a meal item to a plan', async () => {
      vi.mocked(mealPlanRepository.isOwner).mockResolvedValue(true)
      vi.mocked(mealPlanRepository.findById).mockResolvedValue(mockMealPlan as any)
      vi.mocked(mealPlanRepository.addItem).mockResolvedValue(mockItem as any)

      const result = await mealPlanService.addMealItem('user-1', 'plan-1', {
        date: '2024-01-15',
        mealType: 'BREAKFAST',
        recipeId: 'recipe-1',
      })

      expect(result.id).toBe('item-1')
    })

    it('throws when user does not own the plan', async () => {
      vi.mocked(mealPlanRepository.isOwner).mockResolvedValue(false)

      await expect(
        mealPlanService.addMealItem('user-2', 'plan-1', {
          date: '2024-01-15',
          mealType: 'BREAKFAST',
          recipeId: 'recipe-1',
        })
      ).rejects.toThrow('access denied')
    })

    it('throws when item has no recipe or custom meal name', async () => {
      vi.mocked(mealPlanRepository.isOwner).mockResolvedValue(true)
      vi.mocked(mealPlanRepository.findById).mockResolvedValue(mockMealPlan as any)

      await expect(
        mealPlanService.addMealItem('user-1', 'plan-1', {
          date: '2024-01-15',
          mealType: 'BREAKFAST',
        })
      ).rejects.toThrow('recipe or a custom meal name')
    })

    it('throws when item date is outside the plan week', async () => {
      vi.mocked(mealPlanRepository.isOwner).mockResolvedValue(true)
      vi.mocked(mealPlanRepository.findById).mockResolvedValue(mockMealPlan as any)

      await expect(
        mealPlanService.addMealItem('user-1', 'plan-1', {
          date: '2024-01-22', // next week
          mealType: 'DINNER',
          recipeId: 'recipe-1',
        })
      ).rejects.toThrow('within the plan week')
    })
  })

  // ── deleteMealItem ───────────────────────

  describe('deleteMealItem', () => {
    it('deletes an item the user owns', async () => {
      vi.mocked(mealPlanRepository.findItemById).mockResolvedValue(mockItem as any)
      vi.mocked(mealPlanRepository.deleteItem).mockResolvedValue()

      await expect(
        mealPlanService.deleteMealItem('user-1', 'item-1')
      ).resolves.toBeUndefined()
    })

    it('throws when item not found', async () => {
      vi.mocked(mealPlanRepository.findItemById).mockResolvedValue(null)

      await expect(
        mealPlanService.deleteMealItem('user-1', 'nonexistent')
      ).rejects.toThrow('not found')
    })

    it('throws when user does not own the item', async () => {
      vi.mocked(mealPlanRepository.findItemById).mockResolvedValue(mockItem as any)

      await expect(
        mealPlanService.deleteMealItem('user-2', 'item-1')
      ).rejects.toThrow('Access denied')
    })
  })
})
