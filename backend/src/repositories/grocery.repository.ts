// ─────────────────────────────────────────
// Grocery Repository
//
// All DB operations for grocery lists and
// items live here.
// ─────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { CreateGroceryItemDTO, UpdateGroceryItemDTO } from '../types/grocery.types'

// ── Selects ──────────────────────────────

const groceryItemSelect = {
  id: true,
  groceryListId: true,
  ingredientName: true,
  quantity: true,
  unit: true,
  category: true,
  isChecked: true,
  createdAt: true,
  updatedAt: true,
}

const groceryListSelect = {
  id: true,
  userId: true,
  mealPlanId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: groceryItemSelect,
    orderBy: [
      { category: 'asc' as const },
      { ingredientName: 'asc' as const },
    ],
  },
}

export class GroceryRepository {
  /**
   * Get the latest grocery list for a user
   * Returns the most recently created list
   */
  async findLatestByUser(userId: string) {
    return prisma.groceryList.findFirst({
      where: { userId },
      select: groceryListSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get a grocery list by ID
   */
  async findById(id: string) {
    return prisma.groceryList.findUnique({
      where: { id },
      select: groceryListSelect,
    })
  }

  /**
   * Get the grocery list linked to a specific meal plan
   */
  async findByMealPlan(userId: string, mealPlanId: string) {
    return prisma.groceryList.findFirst({
      where: { userId, mealPlanId },
      select: groceryListSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get all grocery lists for a user
   */
  async findAllByUser(userId: string) {
    return prisma.groceryList.findMany({
      where: { userId },
      select: groceryListSelect,
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Create a new grocery list with items in a transaction
   * Either the whole list is created or nothing is
   */
  async create(
    userId: string,
    items: CreateGroceryItemDTO[],
    mealPlanId?: string
  ) {
    return prisma.groceryList.create({
      data: {
        userId,
        mealPlanId: mealPlanId ?? null,
        items: {
          create: items.map((item) => ({
            ingredientName: item.ingredientName.trim(),
            quantity: item.quantity ?? null,
            unit: item.unit?.trim() ?? null,
            category: item.category?.trim() ?? null,
            isChecked: false,
          })),
        },
      },
      select: groceryListSelect,
    })
  }

  /**
   * Get all items for a grocery list
   * Used by the service for dedup checks before insertion
   */
  async findItemsByList(groceryListId: string) {
    return prisma.groceryItem.findMany({
      where: { groceryListId },
      select: groceryItemSelect,
    })
  }

  /**
   * Add a single item to an existing grocery list
   */
  async addItem(groceryListId: string, item: CreateGroceryItemDTO) {
    return prisma.groceryItem.create({
      data: {
        groceryListId,
        ingredientName: item.ingredientName.trim(),
        quantity: item.quantity ?? null,
        unit: item.unit?.trim() ?? null,
        category: item.category?.trim() ?? null,
        isChecked: false,
      },
      select: groceryItemSelect,
    })
  }

  /**
   * Update a grocery item (check/uncheck, rename, etc.)
   */
  async updateItem(id: string, data: UpdateGroceryItemDTO) {
    return prisma.groceryItem.update({
      where: { id },
      data: {
        ...(data.ingredientName !== undefined && {
          ingredientName: data.ingredientName.trim(),
        }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.isChecked !== undefined && { isChecked: data.isChecked }),
      },
      select: groceryItemSelect,
    })
  }

  /**
   * Delete a single grocery item
   */
  async deleteItem(id: string): Promise<void> {
    await prisma.groceryItem.delete({ where: { id } })
  }

  /**
   * Delete an entire grocery list and all its items
   */
  async delete(id: string): Promise<void> {
    await prisma.groceryList.delete({ where: { id } })
  }

  /**
   * Mark all items in a list as checked or unchecked
   * Useful for "check all" / "uncheck all" UI actions
   */
  async checkAllItems(groceryListId: string, isChecked: boolean): Promise<void> {
    await prisma.groceryItem.updateMany({
      where: { groceryListId },
      data: { isChecked },
    })
  }

  /**
   * Find a grocery item by ID
   * Used for ownership checks
   */
  async findItemById(id: string) {
    return prisma.groceryItem.findUnique({
      where: { id },
      select: {
        ...groceryItemSelect,
        groceryList: {
          select: { userId: true, id: true },
        },
      },
    })
  }

  /**
   * Check if a grocery list belongs to a user
   */
  async isOwner(groceryListId: string, userId: string): Promise<boolean> {
    const list = await prisma.groceryList.findUnique({
      where: { id: groceryListId },
      select: { userId: true },
    })
    return list?.userId === userId
  }
}

export default new GroceryRepository()
