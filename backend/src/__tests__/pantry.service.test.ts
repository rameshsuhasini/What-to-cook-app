// ─────────────────────────────────────────
// Pantry Service Tests
// ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import pantryService from '../services/pantry.service'
import pantryRepository from '../repositories/pantry.repository'

vi.mock('../repositories/pantry.repository', () => ({
  default: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByIngredientName: vi.fn(),
    create: vi.fn(),
    bulkCreate: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteAll: vi.fn(),
    getAllIngredientNames: vi.fn(),
    isOwner: vi.fn(),
  },
}))

const mockItem = {
  id: 'item-1',
  userId: 'user-1',
  ingredientName: 'Olive oil',
  quantity: 500,
  unit: 'ml',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('PantryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getPantryItems ───────────────────────

  describe('getPantryItems', () => {
    it('returns paginated pantry items', async () => {
      vi.mocked(pantryRepository.findAll).mockResolvedValue({
        items: [mockItem],
        total: 1,
        page: 1,
        limit: 50,
      })

      const result = await pantryService.getPantryItems('user-1', {})

      expect(result.items).toHaveLength(1)
      expect(result.pagination.total).toBe(1)
      expect(result.pagination.totalPages).toBe(1)
      expect(result.pagination.hasNext).toBe(false)
    })

    it('caps limit at 100', async () => {
      vi.mocked(pantryRepository.findAll).mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 100,
      })

      await pantryService.getPantryItems('user-1', { limit: 9999 })

      expect(pantryRepository.findAll).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ limit: 100 })
      )
    })
  })

  // ── addPantryItem ────────────────────────

  describe('addPantryItem', () => {
    it('creates a new item when it does not exist', async () => {
      vi.mocked(pantryRepository.findByIngredientName).mockResolvedValue(null)
      vi.mocked(pantryRepository.create).mockResolvedValue(mockItem)

      const result = await pantryService.addPantryItem('user-1', {
        ingredientName: 'Olive oil',
        quantity: 500,
        unit: 'ml',
      })

      expect(result.ingredientName).toBe('Olive oil')
      expect(pantryRepository.create).toHaveBeenCalled()
    })

    it('merges quantity when item already exists', async () => {
      vi.mocked(pantryRepository.findByIngredientName).mockResolvedValue(mockItem)
      vi.mocked(pantryRepository.update).mockResolvedValue({
        ...mockItem,
        quantity: 700, // 500 existing + 200 new
      })

      const result = await pantryService.addPantryItem('user-1', {
        ingredientName: 'Olive oil',
        quantity: 200,
        unit: 'ml',
      })

      expect(pantryRepository.update).toHaveBeenCalledWith(
        'item-1',
        expect.objectContaining({ quantity: 700 })
      )
    })

    it('returns existing item without update when no quantity provided', async () => {
      vi.mocked(pantryRepository.findByIngredientName).mockResolvedValue(mockItem)

      const result = await pantryService.addPantryItem('user-1', {
        ingredientName: 'Olive oil',
      })

      expect(pantryRepository.update).not.toHaveBeenCalled()
      expect(pantryRepository.create).not.toHaveBeenCalled()
      expect(result.id).toBe('item-1')
    })
  })

  // ── bulkAddPantryItems ───────────────────

  describe('bulkAddPantryItems', () => {
    it('bulk creates items', async () => {
      vi.mocked(pantryRepository.bulkCreate).mockResolvedValue([mockItem])

      const result = await pantryService.bulkAddPantryItems('user-1', [
        { ingredientName: 'Olive oil', quantity: 500, unit: 'ml' },
      ])

      expect(result).toHaveLength(1)
    })

    it('throws when no items provided', async () => {
      await expect(
        pantryService.bulkAddPantryItems('user-1', [])
      ).rejects.toThrow('No items provided')
    })

    it('throws when more than 100 items provided', async () => {
      const items = Array.from({ length: 101 }, (_, i) => ({
        ingredientName: `Item ${i}`,
      }))

      await expect(
        pantryService.bulkAddPantryItems('user-1', items)
      ).rejects.toThrow('100 items')
    })

    it('throws when an item has no name', async () => {
      await expect(
        pantryService.bulkAddPantryItems('user-1', [{ ingredientName: '' }])
      ).rejects.toThrow('ingredient name')
    })
  })

  // ── updatePantryItem ─────────────────────

  describe('updatePantryItem', () => {
    it('updates item when user is owner', async () => {
      vi.mocked(pantryRepository.isOwner).mockResolvedValue(true)
      vi.mocked(pantryRepository.findByIngredientName).mockResolvedValue(null)
      vi.mocked(pantryRepository.update).mockResolvedValue({
        ...mockItem,
        quantity: 300,
      })

      const result = await pantryService.updatePantryItem('user-1', 'item-1', {
        quantity: 300,
      })

      expect(result.quantity).toBe(300)
    })

    it('throws when user is not the owner', async () => {
      vi.mocked(pantryRepository.isOwner).mockResolvedValue(false)

      await expect(
        pantryService.updatePantryItem('user-2', 'item-1', { quantity: 300 })
      ).rejects.toThrow('access denied')
    })

    it('throws when renaming to an existing ingredient name', async () => {
      vi.mocked(pantryRepository.isOwner).mockResolvedValue(true)
      vi.mocked(pantryRepository.findByIngredientName).mockResolvedValue({
        ...mockItem,
        id: 'item-2', // different item — conflict!
        ingredientName: 'Sunflower oil',
      })

      await expect(
        pantryService.updatePantryItem('user-1', 'item-1', {
          ingredientName: 'Sunflower oil',
        })
      ).rejects.toThrow('already exists')
    })
  })

  // ── deletePantryItem ─────────────────────

  describe('deletePantryItem', () => {
    it('deletes item when user is owner', async () => {
      vi.mocked(pantryRepository.isOwner).mockResolvedValue(true)
      vi.mocked(pantryRepository.delete).mockResolvedValue()

      await expect(
        pantryService.deletePantryItem('user-1', 'item-1')
      ).resolves.toBeUndefined()
    })

    it('throws when user is not the owner', async () => {
      vi.mocked(pantryRepository.isOwner).mockResolvedValue(false)

      await expect(
        pantryService.deletePantryItem('user-2', 'item-1')
      ).rejects.toThrow('access denied')
    })
  })

  // ── clearPantry ──────────────────────────

  describe('clearPantry', () => {
    it('clears all pantry items for a user', async () => {
      vi.mocked(pantryRepository.deleteAll).mockResolvedValue()

      await expect(
        pantryService.clearPantry('user-1')
      ).resolves.toBeUndefined()

      expect(pantryRepository.deleteAll).toHaveBeenCalledWith('user-1')
    })
  })
})
