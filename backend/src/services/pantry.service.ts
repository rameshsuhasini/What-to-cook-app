// ─────────────────────────────────────────
// Pantry Service
//
// Business logic for pantry management:
// - Duplicate prevention on add
// - Bulk add from grocery list
// - Pagination
// - Ownership checks
// ─────────────────────────────────────────

import pantryRepository from '../repositories/pantry.repository'
import {
  CreatePantryItemDTO,
  UpdatePantryItemDTO,
  PantryQueryDTO,
  PantryItemResponse,
  PaginatedPantryResponse,
} from '../types/pantry.types'

export class PantryService {
  /**
   * Sanitize Decimal quantity to number
   */
  private sanitize(item: any): PantryItemResponse {
    return {
      ...item,
      quantity: item.quantity ? Number(item.quantity) : null,
    }
  }

  /**
   * GET ALL PANTRY ITEMS
   * Paginated and searchable list of pantry items
   */
  async getPantryItems(
    userId: string,
    query: PantryQueryDTO
  ): Promise<PaginatedPantryResponse> {
    const page = Math.max(1, query.page ?? 1)
    const limit = Math.min(100, Math.max(1, query.limit ?? 50))

    const { items, total } = await pantryRepository.findAll(userId, {
      ...query,
      page,
      limit,
    })

    const totalPages = Math.ceil(total / limit)

    return {
      items: items.map(this.sanitize),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }

  /**
   * ADD PANTRY ITEM
   * Prevents duplicates — if item already exists,
   * updates quantity instead of creating a new entry
   */
  async addPantryItem(
    userId: string,
    data: CreatePantryItemDTO
  ): Promise<PantryItemResponse> {
    // Check for duplicate
    const existing = await pantryRepository.findByIngredientName(
      userId,
      data.ingredientName
    )

    if (existing) {
      // Update quantity if new quantity provided, else return existing
      if (data.quantity !== undefined) {
        const updated = await pantryRepository.update(existing.id, {
          quantity: (Number(existing.quantity) || 0) + data.quantity,
          unit: data.unit ?? existing.unit,
        })
        return this.sanitize(updated)
      }
      return this.sanitize(existing)
    }

    const item = await pantryRepository.create(userId, data)
    return this.sanitize(item)
  }

  /**
   * BULK ADD PANTRY ITEMS
   * Add multiple items at once — useful for adding
   * items from a completed grocery shop.
   * Merges with existing items instead of duplicating.
   */
  async bulkAddPantryItems(
    userId: string,
    items: CreatePantryItemDTO[]
  ): Promise<PantryItemResponse[]> {
    if (items.length === 0) {
      throw new Error('No items provided')
    }

    if (items.length > 100) {
      throw new Error('Cannot add more than 100 items at once')
    }

    // Validate each item has a name
    for (const item of items) {
      if (!item.ingredientName?.trim()) {
        throw new Error('Each item must have an ingredient name')
      }
    }

    const created = await pantryRepository.bulkCreate(userId, items)
    return created.map(this.sanitize)
  }

  /**
   * UPDATE PANTRY ITEM
   * Only owner can update
   */
  async updatePantryItem(
    userId: string,
    itemId: string,
    data: UpdatePantryItemDTO
  ): Promise<PantryItemResponse> {
    const isOwner = await pantryRepository.isOwner(itemId, userId)
    if (!isOwner) throw new Error('Pantry item not found or access denied')

    // Check for name conflict if renaming
    if (data.ingredientName) {
      const existing = await pantryRepository.findByIngredientName(
        userId,
        data.ingredientName
      )
      if (existing && existing.id !== itemId) {
        throw new Error(
          `"${data.ingredientName}" already exists in your pantry`
        )
      }
    }

    const item = await pantryRepository.update(itemId, data)
    return this.sanitize(item)
  }

  /**
   * DELETE PANTRY ITEM
   * Only owner can delete
   */
  async deletePantryItem(userId: string, itemId: string): Promise<void> {
    const isOwner = await pantryRepository.isOwner(itemId, userId)
    if (!isOwner) throw new Error('Pantry item not found or access denied')

    await pantryRepository.delete(itemId)
  }

  /**
   * CLEAR PANTRY
   * Removes all pantry items for a user
   */
  async clearPantry(userId: string): Promise<void> {
    await pantryRepository.deleteAll(userId)
  }

  /**
   * GET INGREDIENT NAMES
   * Returns a flat list of ingredient names.
   * Used by the AI pantry suggestions feature.
   */
  async getIngredientNames(userId: string): Promise<string[]> {
    return pantryRepository.getAllIngredientNames(userId)
  }
}

export default new PantryService()
