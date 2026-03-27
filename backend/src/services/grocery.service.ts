// ─────────────────────────────────────────
// Grocery Service
//
// Business logic for grocery lists:
// - Generating a list from a meal plan
//   by aggregating all recipe ingredients
// - Deduplicating and merging ingredients
// - Grouping items by category
// - Ownership checks before mutations
// ─────────────────────────────────────────

import { prisma } from '../lib/prisma'
import groceryRepository from '../repositories/grocery.repository'
import {
  CreateGroceryItemDTO,
  UpdateGroceryItemDTO,
  GroceryListResponse,
  GroceryListGroupedResponse,
  GroceryItemResponse,
} from '../types/grocery.types'

// ── Category inference ───────────────────
// Maps common ingredients to grocery
// categories for a better shopping UX

const CATEGORY_MAP: Record<string, string> = {
  // Produce
  tomato: 'Produce', lettuce: 'Produce', spinach: 'Produce',
  onion: 'Produce', garlic: 'Produce', potato: 'Produce',
  carrot: 'Produce', broccoli: 'Produce', pepper: 'Produce',
  mushroom: 'Produce', cucumber: 'Produce', zucchini: 'Produce',
  lemon: 'Produce', lime: 'Produce', avocado: 'Produce',
  banana: 'Produce', apple: 'Produce', berry: 'Produce',
  // Meat & Seafood
  chicken: 'Meat & Seafood', beef: 'Meat & Seafood', pork: 'Meat & Seafood',
  lamb: 'Meat & Seafood', turkey: 'Meat & Seafood', salmon: 'Meat & Seafood',
  tuna: 'Meat & Seafood', shrimp: 'Meat & Seafood', fish: 'Meat & Seafood',
  bacon: 'Meat & Seafood', sausage: 'Meat & Seafood',
  // Dairy
  milk: 'Dairy', cheese: 'Dairy', butter: 'Dairy', cream: 'Dairy',
  yogurt: 'Dairy', egg: 'Dairy', mozzarella: 'Dairy', parmesan: 'Dairy',
  // Pantry
  flour: 'Pantry', sugar: 'Pantry', salt: 'Pantry', chilli: 'Pantry',
  oil: 'Pantry', vinegar: 'Pantry', soy: 'Pantry', sauce: 'Pantry',
  pasta: 'Pantry', rice: 'Pantry', bread: 'Pantry', oat: 'Pantry',
  // Canned & Jarred
  tomatoes: 'Canned & Jarred', beans: 'Canned & Jarred',
  lentil: 'Canned & Jarred', chickpea: 'Canned & Jarred',
  // Spices & Herbs
  basil: 'Spices & Herbs', oregano: 'Spices & Herbs', thyme: 'Spices & Herbs',
  rosemary: 'Spices & Herbs', cumin: 'Spices & Herbs', paprika: 'Spices & Herbs',
  cinnamon: 'Spices & Herbs', ginger: 'Spices & Herbs', turmeric: 'Spices & Herbs',
}

export class GroceryService {
  /**
   * Infer a grocery category from an ingredient name
   * Falls back to "Other" if no match found
   */
  private inferCategory(ingredientName: string): string {
    const lower = ingredientName.toLowerCase()
    for (const [keyword, category] of Object.entries(CATEGORY_MAP)) {
      if (lower.includes(keyword)) return category
    }
    return 'Other'
  }

  /**
   * Merge duplicate ingredients from multiple recipes
   * Combines quantities where units match,
   * keeps separate entries where units differ
   */
  private mergeIngredients(
    ingredients: Array<{
      ingredientName: string
      quantity: number | null
      unit: string | null
    }>
  ): CreateGroceryItemDTO[] {
    // Key = "ingredientname|unit" for deduplication
    const merged = new Map<string, CreateGroceryItemDTO>()

    for (const ing of ingredients) {
      const key = `${ing.ingredientName.toLowerCase().trim()}|${ing.unit?.toLowerCase() ?? ''}`

      if (merged.has(key)) {
        const existing = merged.get(key)!
        // Add quantities if both are numbers
        if (existing.quantity !== undefined && ing.quantity !== null) {
          existing.quantity = (existing.quantity ?? 0) + ing.quantity
        }
      } else {
        merged.set(key, {
          ingredientName: ing.ingredientName.trim(),
          quantity: ing.quantity ?? undefined,
          unit: ing.unit ?? undefined,
          category: this.inferCategory(ing.ingredientName),
        })
      }
    }

    return Array.from(merged.values())
  }

  /**
   * Group grocery items by category for frontend rendering
   */
  private groupByCategory(
    list: GroceryListResponse
  ): GroceryListGroupedResponse {
    const { items, ...listMeta } = list

    // Build category groups
    const categoryMap = new Map<string, GroceryItemResponse[]>()

    for (const item of items) {
      const cat = item.category ?? 'Other'
      if (!categoryMap.has(cat)) categoryMap.set(cat, [])
      categoryMap.get(cat)!.push(item)
    }

    // Sort categories alphabetically, "Other" goes last
    const categories = Array.from(categoryMap.entries())
      .sort(([a], [b]) => {
        if (a === 'Other') return 1
        if (b === 'Other') return -1
        return a.localeCompare(b)
      })
      .map(([name, items]) => ({ name, items }))

    const checkedItems = items.filter((i) => i.isChecked).length

    return {
      list: listMeta,
      categories,
      summary: {
        totalItems: items.length,
        checkedItems,
        remainingItems: items.length - checkedItems,
      },
    }
  }

  // ── Service methods ──────────────────────

  /**
   * GET GROCERY LIST
   * Returns the latest grocery list for the user, grouped by category
   */
  async getGroceryList(userId: string): Promise<GroceryListGroupedResponse | null> {
    const list = await groceryRepository.findLatestByUser(userId)
    if (!list) return null

    return this.groupByCategory(this.sanitizeList(list))
  }

  /**
   * GET GROCERY LIST BY ID
   */
  async getGroceryListById(
    id: string,
    userId: string
  ): Promise<GroceryListGroupedResponse> {
    const list = await groceryRepository.findById(id)

    if (!list) throw new Error('Grocery list not found')

    if (list.userId !== userId) throw new Error('Access denied')

    return this.groupByCategory(this.sanitizeList(list))
  }

  /**
   * GENERATE GROCERY LIST FROM MEAL PLAN
   * Pulls all recipe ingredients from a week's meal plan,
   * merges duplicates, infers categories, and creates a list.
   *
   * If a list already exists for this meal plan, it is
   * deleted and regenerated fresh.
   */
  async generateFromMealPlan(
    userId: string,
    mealPlanId: string
  ): Promise<GroceryListGroupedResponse> {
    // Verify meal plan exists and belongs to user
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      select: {
        userId: true,
        items: {
          select: {
            recipe: {
              select: {
                title: true,
                servings: true,
                ingredients: {
                  select: {
                    ingredientName: true,
                    quantity: true,
                    unit: true,
                  },
                },
              },
            },
            customMealName: true,
          },
        },
      },
    })

    if (!mealPlan) throw new Error('Meal plan not found')
    if (mealPlan.userId !== userId) throw new Error('Access denied')

    // Collect all ingredients from all recipes in the plan
    const allIngredients: Array<{
      ingredientName: string
      quantity: number | null
      unit: string | null
    }> = []

    for (const item of mealPlan.items) {
      if (item.recipe?.ingredients) {
        for (const ing of item.recipe.ingredients) {
          allIngredients.push({
            ingredientName: ing.ingredientName,
            quantity: ing.quantity ? Number(ing.quantity) : null,
            unit: ing.unit,
          })
        }
      }
    }

    if (allIngredients.length === 0) {
      throw new Error(
        'No ingredients found in this meal plan. Make sure your meals have recipes with ingredients.'
      )
    }

    // Merge duplicates and infer categories
    const mergedItems = this.mergeIngredients(allIngredients)

    // Delete existing list for this meal plan if one exists
    const existing = await groceryRepository.findByMealPlan(userId, mealPlanId)
    if (existing) {
      await groceryRepository.delete(existing.id)
    }

    // Create fresh list
    const list = await groceryRepository.create(userId, mergedItems, mealPlanId)

    return this.groupByCategory(this.sanitizeList(list))
  }

  /**
   * ADD ITEM TO LIST
   * Manually add an item to an existing grocery list
   */
  async addItem(
    userId: string,
    groceryListId: string,
    item: CreateGroceryItemDTO
  ): Promise<GroceryItemResponse> {
    const isOwner = await groceryRepository.isOwner(groceryListId, userId)
    if (!isOwner) throw new Error('Grocery list not found or access denied')

    // Infer category if not provided
    const itemWithCategory = {
      ...item,
      category: item.category ?? this.inferCategory(item.ingredientName),
    }

    const created = await groceryRepository.addItem(groceryListId, itemWithCategory)
    return this.sanitizeItem(created)
  }

  /**
   * UPDATE ITEM
   * Check/uncheck, rename, or recategorise an item
   */
  async updateItem(
    userId: string,
    itemId: string,
    data: UpdateGroceryItemDTO
  ): Promise<GroceryItemResponse> {
    const item = await groceryRepository.findItemById(itemId)

    if (!item) throw new Error('Grocery item not found')
    if ((item as any).groceryList?.userId !== userId) throw new Error('Access denied')

    const updated = await groceryRepository.updateItem(itemId, data)
    return this.sanitizeItem(updated)
  }

  /**
   * DELETE ITEM
   * Remove a single item from the list
   */
  async deleteItem(userId: string, itemId: string): Promise<void> {
    const item = await groceryRepository.findItemById(itemId)

    if (!item) throw new Error('Grocery item not found')
    if ((item as any).groceryList?.userId !== userId) throw new Error('Access denied')

    await groceryRepository.deleteItem(itemId)
  }

  /**
   * CHECK ALL / UNCHECK ALL
   * Bulk toggle all items in a list
   */
  async checkAllItems(
    userId: string,
    groceryListId: string,
    isChecked: boolean
  ): Promise<void> {
    const isOwner = await groceryRepository.isOwner(groceryListId, userId)
    if (!isOwner) throw new Error('Grocery list not found or access denied')

    await groceryRepository.checkAllItems(groceryListId, isChecked)
  }

  // ── Private helpers ──────────────────────

  /**
   * Convert Decimal quantity to number on list
   */
  private sanitizeList(list: any): GroceryListResponse {
    return {
      ...list,
      items: list.items.map((i: any) => this.sanitizeItem(i)),
    }
  }

  private sanitizeItem(item: any): GroceryItemResponse {
    return {
      ...item,
      quantity: item.quantity ? Number(item.quantity) : null,
    }
  }
}

export default new GroceryService()
