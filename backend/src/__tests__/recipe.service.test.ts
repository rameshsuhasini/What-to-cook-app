// ─────────────────────────────────────────
// Recipe Service Tests
// ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest'
import recipeService from '../services/recipe.service'
import recipeRepository from '../repositories/recipe.repository'
import { CreateRecipeDTO } from '../types/recipe.types'

// Mock the repository so tests never hit the DB
vi.mock('../repositories/recipe.repository', () => ({
  default: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    saveRecipe: vi.fn(),
    unsaveRecipe: vi.fn(),
    getSavedRecipes: vi.fn(),
    isOwner: vi.fn(),
  },
}))

const mockRecipe = {
  id: 'recipe-1',
  title: 'Spaghetti Carbonara',
  description: 'Classic Italian pasta',
  imageUrl: null,
  prepTimeMinutes: 15,
  cookTimeMinutes: 20,
  servings: 4,
  calories: 520,
  protein: 22,
  carbs: 65,
  fat: 18,
  cuisine: 'Italian',
  dietType: 'NONE' as const,
  isAiGenerated: false,
  createdByUserId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  ingredients: [
    { id: 'ing-1', ingredientName: 'Spaghetti', quantity: 400, unit: 'g' },
    { id: 'ing-2', ingredientName: 'Eggs', quantity: 4, unit: null },
  ],
  steps: [
    { id: 'step-1', stepNumber: 1, instructionText: 'Boil pasta in salted water' },
    { id: 'step-2', stepNumber: 2, instructionText: 'Mix eggs and cheese' },
  ],
  isSaved: false,
}

const mockCreateDTO: CreateRecipeDTO = {
  title: 'Spaghetti Carbonara',
  description: 'Classic Italian pasta',
  prepTimeMinutes: 15,
  cookTimeMinutes: 20,
  servings: 4,
  calories: 520,
  protein: 22,
  carbs: 65,
  fat: 18,
  cuisine: 'Italian',
  ingredients: [
    { ingredientName: 'Spaghetti', quantity: 400, unit: 'g' },
    { ingredientName: 'Eggs', quantity: 4 },
  ],
  steps: [
    { stepNumber: 1, instructionText: 'Boil pasta in salted water' },
    { stepNumber: 2, instructionText: 'Mix eggs and cheese' },
  ],
}

describe('RecipeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getRecipes ───────────────────────────

  describe('getRecipes', () => {
    it('returns paginated recipes with correct pagination metadata', async () => {
      vi.mocked(recipeRepository.findAll).mockResolvedValue({
        recipes: [mockRecipe],
        total: 25,
        page: 1,
        limit: 12,
      })

      const result = await recipeService.getRecipes({ page: 1, limit: 12 })

      expect(result.recipes).toHaveLength(1)
      expect(result.pagination.total).toBe(25)
      expect(result.pagination.totalPages).toBe(3)
      expect(result.pagination.hasNext).toBe(true)
      expect(result.pagination.hasPrev).toBe(false)
    })

    it('caps limit at 50 to prevent abuse', async () => {
      vi.mocked(recipeRepository.findAll).mockResolvedValue({
        recipes: [],
        total: 0,
        page: 1,
        limit: 50,
      })

      await recipeService.getRecipes({ limit: 9999 })

      expect(recipeRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 50 }),
        undefined
      )
    })

    it('enforces minimum page of 1', async () => {
      vi.mocked(recipeRepository.findAll).mockResolvedValue({
        recipes: [],
        total: 0,
        page: 1,
        limit: 12,
      })

      await recipeService.getRecipes({ page: -5 })

      expect(recipeRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
        undefined
      )
    })
  })

  // ── getRecipeById ────────────────────────

  describe('getRecipeById', () => {
    it('returns a recipe when found', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(mockRecipe)

      const result = await recipeService.getRecipeById('recipe-1')

      expect(result.id).toBe('recipe-1')
      expect(result.title).toBe('Spaghetti Carbonara')
    })

    it('throws an error when recipe not found', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(null)

      await expect(recipeService.getRecipeById('nonexistent')).rejects.toThrow(
        'Recipe not found'
      )
    })
  })

  // ── createRecipe ─────────────────────────

  describe('createRecipe', () => {
    it('creates a recipe successfully', async () => {
      vi.mocked(recipeRepository.create).mockResolvedValue(mockRecipe)

      const result = await recipeService.createRecipe(mockCreateDTO, 'user-1')

      expect(result.title).toBe('Spaghetti Carbonara')
      expect(recipeRepository.create).toHaveBeenCalledWith(
        mockCreateDTO,
        'user-1'
      )
    })

    it('throws when no ingredients provided', async () => {
      const data = { ...mockCreateDTO, ingredients: [] }

      await expect(recipeService.createRecipe(data, 'user-1')).rejects.toThrow(
        'at least one ingredient'
      )
    })

    it('throws when no steps provided', async () => {
      const data = { ...mockCreateDTO, steps: [] }

      await expect(recipeService.createRecipe(data, 'user-1')).rejects.toThrow(
        'at least one step'
      )
    })

    it('throws when step numbers are duplicated', async () => {
      const data = {
        ...mockCreateDTO,
        steps: [
          { stepNumber: 1, instructionText: 'Step one' },
          { stepNumber: 1, instructionText: 'Duplicate step number' },
        ],
      }

      await expect(recipeService.createRecipe(data, 'user-1')).rejects.toThrow(
        'unique step numbers'
      )
    })

    it('throws when calories are negative', async () => {
      const data = { ...mockCreateDTO, calories: -100 }

      await expect(recipeService.createRecipe(data, 'user-1')).rejects.toThrow(
        'calories cannot be negative'
      )
    })
  })

  // ── updateRecipe ─────────────────────────

  describe('updateRecipe', () => {
    it('updates a recipe when user is the owner', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(mockRecipe)
      vi.mocked(recipeRepository.isOwner).mockResolvedValue(true)
      vi.mocked(recipeRepository.update).mockResolvedValue({
        ...mockRecipe,
        title: 'Updated Title',
      })

      const result = await recipeService.updateRecipe(
        'recipe-1',
        { title: 'Updated Title' },
        'user-1'
      )

      expect(result.title).toBe('Updated Title')
    })

    it('throws when recipe not found', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(null)

      await expect(
        recipeService.updateRecipe('nonexistent', { title: 'x' }, 'user-1')
      ).rejects.toThrow('Recipe not found')
    })

    it('throws when user is not the owner', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(mockRecipe)
      vi.mocked(recipeRepository.isOwner).mockResolvedValue(false)

      await expect(
        recipeService.updateRecipe('recipe-1', { title: 'x' }, 'user-2')
      ).rejects.toThrow('permission')
    })
  })

  // ── deleteRecipe ─────────────────────────

  describe('deleteRecipe', () => {
    it('deletes a recipe when user is the owner', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(mockRecipe)
      vi.mocked(recipeRepository.isOwner).mockResolvedValue(true)
      vi.mocked(recipeRepository.delete).mockResolvedValue()

      await expect(
        recipeService.deleteRecipe('recipe-1', 'user-1')
      ).resolves.toBeUndefined()
    })

    it('throws when user is not the owner', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(mockRecipe)
      vi.mocked(recipeRepository.isOwner).mockResolvedValue(false)

      await expect(
        recipeService.deleteRecipe('recipe-1', 'user-2')
      ).rejects.toThrow('permission')
    })
  })

  // ── saveRecipe ───────────────────────────

  describe('saveRecipe', () => {
    it('saves a recipe that exists', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(mockRecipe)
      vi.mocked(recipeRepository.saveRecipe).mockResolvedValue({} as any)

      await expect(
        recipeService.saveRecipe('recipe-1', 'user-1')
      ).resolves.toBeUndefined()
    })

    it('throws when recipe does not exist', async () => {
      vi.mocked(recipeRepository.findById).mockResolvedValue(null)

      await expect(
        recipeService.saveRecipe('nonexistent', 'user-1')
      ).rejects.toThrow('Recipe not found')
    })
  })

  // ── unsaveRecipe ─────────────────────────

  describe('unsaveRecipe', () => {
    it('unsaves a recipe silently even if not saved (idempotent)', async () => {
      vi.mocked(recipeRepository.unsaveRecipe).mockRejectedValue(
        new Error('Record not found')
      )

      // Should NOT throw — idempotent behaviour
      await expect(
        recipeService.unsaveRecipe('recipe-1', 'user-1')
      ).resolves.toBeUndefined()
    })
  })
})
