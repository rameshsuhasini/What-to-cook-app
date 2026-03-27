// ─────────────────────────────────────────
// Grocery Service Tests
// ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import groceryService from '../services/grocery.service'
import groceryRepository from '../repositories/grocery.repository'
import { prisma } from '../lib/prisma'

vi.mock('../repositories/grocery.repository', () => ({
  default: {
    findLatestByUser: vi.fn(),
    findById: vi.fn(),
    findByMealPlan: vi.fn(),
    findItemById: vi.fn(),
    create: vi.fn(),
    addItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    delete: vi.fn(),
    checkAllItems: vi.fn(),
    isOwner: vi.fn(),
  },
}))

vi.mock('../lib/prisma', () => ({
  prisma: {
    mealPlan: {
      findUnique: vi.fn(),
    },
  },
}))

const mockList = {
  id: 'list-1',
  userId: 'user-1',
  mealPlanId: 'plan-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 'item-1',
      groceryListId: 'list-1',
      ingredientName: 'Spaghetti',
      quantity: 400,
      unit: 'g',
      category: 'Pantry',
      isChecked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'item-2',
      groceryListId: 'list-1',
      ingredientName: 'Chicken breast',
      quantity: 500,
      unit: 'g',
      category: 'Meat & Seafood',
      isChecked: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
}

const mockMealPlan = {
  userId: 'user-1',
  items: [
    {
      recipe: {
        title: 'Spaghetti Carbonara',
        servings: 4,
        ingredients: [
          { ingredientName: 'Spaghetti', quantity: '400', unit: 'g' },
          { ingredientName: 'Eggs', quantity: '4', unit: null },
        ],
      },
      customMealName: null,
    },
    {
      recipe: {
        title: 'Pasta Bolognese',
        servings: 4,
        ingredients: [
          { ingredientName: 'Spaghetti', quantity: '400', unit: 'g' }, // duplicate
          { ingredientName: 'Beef mince', quantity: '500', unit: 'g' },
        ],
      },
      customMealName: null,
    },
  ],
}

describe('GroceryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getGroceryList ───────────────────────

  describe('getGroceryList', () => {
    it('returns null when no list exists', async () => {
      vi.mocked(groceryRepository.findLatestByUser).mockResolvedValue(null)

      const result = await groceryService.getGroceryList('user-1')
      expect(result).toBeNull()
    })

    it('returns a grouped list with summary', async () => {
      vi.mocked(groceryRepository.findLatestByUser).mockResolvedValue(mockList as any)

      const result = await groceryService.getGroceryList('user-1')

      expect(result).not.toBeNull()
      expect(result!.categories.length).toBeGreaterThan(0)
      expect(result!.summary.totalItems).toBe(2)
      expect(result!.summary.checkedItems).toBe(1)
      expect(result!.summary.remainingItems).toBe(1)
    })

    it('sorts categories alphabetically with Other last', async () => {
      const listWithOther = {
        ...mockList,
        items: [
          ...mockList.items,
          {
            id: 'item-3',
            groceryListId: 'list-1',
            ingredientName: 'Mystery ingredient',
            quantity: null,
            unit: null,
            category: 'Other',
            isChecked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }
      vi.mocked(groceryRepository.findLatestByUser).mockResolvedValue(listWithOther as any)

      const result = await groceryService.getGroceryList('user-1')
      const categoryNames = result!.categories.map((c) => c.name)
      expect(categoryNames[categoryNames.length - 1]).toBe('Other')
    })
  })

  // ── generateFromMealPlan ─────────────────

  describe('generateFromMealPlan', () => {
    it('generates a grocery list merging duplicate ingredients', async () => {
      vi.mocked(prisma.mealPlan.findUnique as any).mockResolvedValue(mockMealPlan)
      vi.mocked(groceryRepository.findByMealPlan).mockResolvedValue(null)
      vi.mocked(groceryRepository.create).mockResolvedValue({
        ...mockList,
        items: [
          {
            id: 'item-1',
            groceryListId: 'list-1',
            ingredientName: 'Spaghetti',
            quantity: 800, // 400 + 400 merged
            unit: 'g',
            category: 'Pantry',
            isChecked: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as any)

      const result = await groceryService.generateFromMealPlan('user-1', 'plan-1')

      expect(result).not.toBeNull()
      // Verify create was called — ingredients were merged
      expect(groceryRepository.create).toHaveBeenCalledWith(
        'user-1',
        expect.arrayContaining([
          expect.objectContaining({ ingredientName: 'Spaghetti', quantity: 800 }),
        ]),
        'plan-1'
      )
    })

    it('deletes existing list before regenerating', async () => {
      vi.mocked(prisma.mealPlan.findUnique as any).mockResolvedValue(mockMealPlan)
      vi.mocked(groceryRepository.findByMealPlan).mockResolvedValue(mockList as any)
      vi.mocked(groceryRepository.delete).mockResolvedValue()
      vi.mocked(groceryRepository.create).mockResolvedValue(mockList as any)

      await groceryService.generateFromMealPlan('user-1', 'plan-1')

      expect(groceryRepository.delete).toHaveBeenCalledWith('list-1')
    })

    it('throws when meal plan not found', async () => {
      vi.mocked(prisma.mealPlan.findUnique as any).mockResolvedValue(null)

      await expect(
        groceryService.generateFromMealPlan('user-1', 'nonexistent')
      ).rejects.toThrow('Meal plan not found')
    })

    it('throws when meal plan has no recipe ingredients', async () => {
      vi.mocked(prisma.mealPlan.findUnique as any).mockResolvedValue({
        userId: 'user-1',
        items: [{ recipe: null, customMealName: 'Custom meal' }],
      })

      await expect(
        groceryService.generateFromMealPlan('user-1', 'plan-1')
      ).rejects.toThrow('No ingredients found')
    })

    it('throws when user does not own the meal plan', async () => {
      vi.mocked(prisma.mealPlan.findUnique as any).mockResolvedValue({
        ...mockMealPlan,
        userId: 'other-user',
      })

      await expect(
        groceryService.generateFromMealPlan('user-1', 'plan-1')
      ).rejects.toThrow('Access denied')
    })
  })

  // ── updateItem ───────────────────────────

  describe('updateItem', () => {
    it('updates an item the user owns', async () => {
      vi.mocked(groceryRepository.findItemById).mockResolvedValue({
        ...mockList.items[0],
        groceryList: { userId: 'user-1', id: 'list-1' },
      } as any)
      vi.mocked(groceryRepository.updateItem).mockResolvedValue({
        ...mockList.items[0],
        isChecked: true,
      } as any)

      const result = await groceryService.updateItem('user-1', 'item-1', {
        isChecked: true,
      })

      expect(result.isChecked).toBe(true)
    })

    it('throws when user does not own the item', async () => {
      vi.mocked(groceryRepository.findItemById).mockResolvedValue({
        ...mockList.items[0],
        groceryList: { userId: 'other-user', id: 'list-1' },
      } as any)

      await expect(
        groceryService.updateItem('user-1', 'item-1', { isChecked: true })
      ).rejects.toThrow('Access denied')
    })
  })

  // ── category inference ───────────────────

  describe('category inference', () => {
    it('infers correct categories for common ingredients', async () => {
      vi.mocked(groceryRepository.isOwner).mockResolvedValue(true)
      vi.mocked(groceryRepository.addItem).mockImplementation(async (_, item) => ({
        id: 'new-item',
        groceryListId: 'list-1',
        ingredientName: item.ingredientName,
        quantity: null,
        unit: null,
        category: item.category ?? null,
        isChecked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))

      const chickenItem = await groceryService.addItem('user-1', 'list-1', {
        ingredientName: 'Chicken breast',
      })
      expect(chickenItem.category).toBe('Meat & Seafood')

      const milkItem = await groceryService.addItem('user-1', 'list-1', {
        ingredientName: 'Whole milk',
      })
      expect(milkItem.category).toBe('Dairy')
    })
  })
})
