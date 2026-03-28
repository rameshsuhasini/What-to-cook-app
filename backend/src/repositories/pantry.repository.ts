// ─────────────────────────────────────────
// Pantry Repository
//
// All DB operations for pantry items.
// ─────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { CreatePantryItemDTO, UpdatePantryItemDTO, PantryQueryDTO } from '../types/pantry.types'

const pantryItemSelect = {
  id: true,
  userId: true,
  ingredientName: true,
  quantity: true,
  unit: true,
  createdAt: true,
  updatedAt: true,
}

export class PantryRepository {
  /**
   * Find all pantry items for a user with optional search + pagination
   */
  async findAll(userId: string, query: PantryQueryDTO) {
    const { search, page = 1, limit = 50 } = query
    const skip = (page - 1) * limit

    const where: Prisma.PantryItemWhereInput = {
      userId,
      ...(search && {
        ingredientName: { contains: search, mode: 'insensitive' },
      }),
    }

    const [total, items] = await Promise.all([
      prisma.pantryItem.count({ where }),
      prisma.pantryItem.findMany({
        where,
        select: pantryItemSelect,
        orderBy: { ingredientName: 'asc' },
        skip,
        take: limit,
      }),
    ])

    return { items, total, page, limit }
  }

  /**
   * Find a single pantry item by ID
   */
  async findById(id: string) {
    return prisma.pantryItem.findUnique({
      where: { id },
      select: pantryItemSelect,
    })
  }

  /**
   * Find a pantry item by ingredient name for a user
   * Used to check for duplicates before creating
   */
  async findByIngredientName(userId: string, ingredientName: string) {
    return prisma.pantryItem.findFirst({
      where: {
        userId,
        ingredientName: { equals: ingredientName.trim(), mode: 'insensitive' },
      },
      select: pantryItemSelect,
    })
  }

  /**
   * Create a single pantry item
   */
  async create(userId: string, data: CreatePantryItemDTO) {
    return prisma.pantryItem.create({
      data: {
        userId,
        ingredientName: data.ingredientName.trim(),
        quantity: data.quantity ?? null,
        unit: data.unit?.trim() ?? null,
      },
      select: pantryItemSelect,
    })
  }

  /**
   * Bulk create multiple pantry items in a single transaction
   * Skips duplicates — does not throw if item already exists
   */
  async bulkCreate(userId: string, items: CreatePantryItemDTO[]) {
    return prisma.$transaction(async (tx) => {
      const results = []

      for (const item of items) {
        // Check if item already exists for this user
        const existing = await tx.pantryItem.findFirst({
          where: {
            userId,
            ingredientName: {
              equals: item.ingredientName.trim(),
              mode: 'insensitive',
            },
          },
        })

        if (existing) {
          // Update quantity if provided, otherwise skip
          if (item.quantity !== undefined) {
            const updated = await tx.pantryItem.update({
              where: { id: existing.id },
              data: {
                quantity: item.quantity,
                unit: item.unit?.trim() ?? existing.unit,
              },
              select: pantryItemSelect,
            })
            results.push(updated)
          } else {
            results.push(existing)
          }
        } else {
          const created = await tx.pantryItem.create({
            data: {
              userId,
              ingredientName: item.ingredientName.trim(),
              quantity: item.quantity ?? null,
              unit: item.unit?.trim() ?? null,
            },
            select: pantryItemSelect,
          })
          results.push(created)
        }
      }

      return results
    })
  }

  /**
   * Update a pantry item
   */
  async update(id: string, data: UpdatePantryItemDTO) {
    return prisma.pantryItem.update({
      where: { id },
      data: {
        ...(data.ingredientName !== undefined && {
          ingredientName: data.ingredientName.trim(),
        }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
      },
      select: pantryItemSelect,
    })
  }

  /**
   * Delete a single pantry item
   */
  async delete(id: string): Promise<void> {
    await prisma.pantryItem.delete({ where: { id } })
  }

  /**
   * Delete all pantry items for a user
   * Used for "clear pantry" action
   */
  async deleteAll(userId: string): Promise<void> {
    await prisma.pantryItem.deleteMany({ where: { userId } })
  }

  /**
   * Get all pantry ingredient names for a user
   * Used by AI pantry suggestions to know what's available
   */
  async getAllIngredientNames(userId: string): Promise<string[]> {
    const items = await prisma.pantryItem.findMany({
      where: { userId },
      select: { ingredientName: true },
      orderBy: { ingredientName: 'asc' },
    })
    return items.map((i) => i.ingredientName)
  }

  /**
   * Check if a pantry item belongs to a user
   */
  async isOwner(itemId: string, userId: string): Promise<boolean> {
    const item = await prisma.pantryItem.findUnique({
      where: { id: itemId },
      select: { userId: true },
    })
    return item?.userId === userId
  }
}

export default new PantryRepository()
