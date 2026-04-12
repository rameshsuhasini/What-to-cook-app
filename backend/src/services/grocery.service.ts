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
import pantryRepository from '../repositories/pantry.repository'
import { aggregateGroceryList } from '../ai/groceryAI'
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
  // Dairy & Eggs
  milk: 'Dairy & Eggs', cheese: 'Dairy & Eggs', butter: 'Dairy & Eggs', cream: 'Dairy & Eggs',
  yogurt: 'Dairy & Eggs', egg: 'Dairy & Eggs', mozzarella: 'Dairy & Eggs', parmesan: 'Dairy & Eggs',
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

// ── Unit normalisation ───────────────────
// Maps verbose/plural unit spellings to canonical short forms.
// Used in BOTH mergeIngredients (AI-generated lists) and
// addItem (manual adds) so that "grams" and "g" are treated
// as the same unit throughout.

const UNIT_ALIASES: Record<string, string> = {
  gram: 'g', grams: 'g',
  kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  ounce: 'oz', ounces: 'oz',
  tablespoon: 'tbsp', tablespoons: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp',
  piece: 'pcs', pieces: 'pcs', pc: 'pcs',
  cup: 'cups',
}

export class GroceryService {
  /**
   * Normalise a unit string to its canonical short form.
   * e.g. "grams" → "g", "Tablespoons" → "tbsp", "" → ""
   */
  private normalizeUnit(unit: string | null | undefined): string {
    if (!unit) return ''
    const lower = unit.toLowerCase().trim()
    return UNIT_ALIASES[lower] ?? lower
  }

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
   * Normalize an ingredient name to a canonical form used ONLY for dedup keying.
   *
   * Problem: AI generates slightly different names across recipes for the same
   * ingredient — e.g. "boneless chicken breast", "chicken breast, cubed",
   * "lean ground turkey (93/7)", "ground turkey (93% lean)", "basil leaves",
   * "garlic cloves", "bell peppers".
   * Exact-string keying misses all of these.
   *
   * Strategy (order matters):
   *   1. Lowercase + trim
   *   2. Strip parenthetical qualifiers:  "(93% lean)" "(cod or tilapia)"
   *   3. Strip everything after first comma:  ", cubed"  ", low sodium"
   *   4. Strip standalone leading descriptor words that don't define the
   *      ingredient's type (boneless, skinless, lean, extra, etc.)
   *   5. Strip trailing form words:  "leaves", "cloves", "florets", "stalks", "sprigs"
   *   6. Singularize: strip trailing 's' from last word if len > 3 and not ending 'ss'
   *      e.g. "peppers" → "pepper", "eggs" → "egg", but NOT "peas" → "pea"
   *   7. Collapse whitespace
   */
  private normalizeIngredientName(name: string): string {
    const LEADING_DESCRIPTORS = new Set([
      'boneless', 'skinless', 'lean', 'extra', 'fresh', 'raw',
      'frozen', 'dried', 'organic', 'baby', 'large', 'small', 'medium',
      'reduced', 'fat-free', 'low-fat',
    ])
    const TRAILING_FORM_WORDS = new Set([
      'leaves', 'leaf', 'cloves', 'clove', 'florets', 'floret',
      'stalks', 'stalk', 'sprigs', 'sprig',
    ])

    let n = name.toLowerCase().trim()
    // Step 2 — remove parenthetical text
    n = n.replace(/\([^)]*\)/g, '')
    // Step 3 — strip from first comma onward
    n = n.replace(/,.*$/, '')
    // Step 4 — strip leading single-word descriptors
    const words = n.trim().split(/\s+/).filter(Boolean)
    while (words.length > 1 && LEADING_DESCRIPTORS.has(words[0])) {
      words.shift()
    }
    // Step 5 — strip trailing form words (e.g. "basil leaves" → "basil", "garlic cloves" → "garlic")
    while (words.length > 1 && TRAILING_FORM_WORDS.has(words[words.length - 1])) {
      words.pop()
    }
    // Step 6 — singularize last word (e.g. "peppers" → "pepper", "eggs" → "egg")
    const last = words[words.length - 1]
    if (last && last.endsWith('s') && last.length > 3 && !last.endsWith('ss')) {
      words[words.length - 1] = last.slice(0, -1)
    }
    // Step 7 — collapse whitespace
    return words.join(' ').trim()
  }

  /**
   * Merge duplicate ingredients from multiple recipes.
   * Combines quantities where units match,
   * keeps separate entries where units differ.
   *
   * Dedup key uses the *normalized* name so that
   * "boneless chicken breast", "chicken breast, cubed", and "chicken breast"
   * all resolve to the same entry.
   */
  private mergeIngredients(
    ingredients: Array<{
      ingredientName: string
      quantity: number | null
      unit: string | null
    }>
  ): CreateGroceryItemDTO[] {
    // Key = "normalized-name|unit"
    const merged = new Map<string, CreateGroceryItemDTO>()

    for (const ing of ingredients) {
      const normalized = this.normalizeIngredientName(ing.ingredientName)
      const key = `${normalized}|${this.normalizeUnit(ing.unit)}`

      if (merged.has(key)) {
        const existing = merged.get(key)!
        // Sum quantities when both are present
        if (existing.quantity !== undefined && ing.quantity !== null) {
          existing.quantity = (existing.quantity ?? 0) + ing.quantity
        }
      } else {
        // Use the normalized name as the display name so the list stays clean
        merged.set(key, {
          ingredientName: normalized.charAt(0).toUpperCase() + normalized.slice(1),
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
   *
   * Supports flexible date ranges and two conflict modes:
   *
   * mode = 'replace' (default):
   *   Delete any existing list for this meal plan and generate a
   *   fresh one from the selected dates.
   *
   * mode = 'merge':
   *   Append to the existing list without deleting it.
   *   Token-saving optimisation — ingredients already in the list
   *   skip the AI pipeline entirely; only genuinely new ingredients
   *   are sent to Claude.
   *
   * @param dates - ISO date strings to include ('YYYY-MM-DD').
   *                If empty / omitted → all items in the meal plan.
   */
  async generateFromMealPlan(
    userId: string,
    mealPlanId: string,
    options: {
      dates?: string[]
      mode?: 'replace' | 'merge'
    } = {}
  ): Promise<GroceryListGroupedResponse> {
    const { dates, mode = 'replace' } = options

    // Verify meal plan exists and belongs to user
    // Optionally filter items to only the requested dates
    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      select: {
        userId: true,
        items: {
          ...(dates && dates.length > 0
            ? {
                where: {
                  date: {
                    in: dates.map((d) => {
                      const [y, m, day] = d.split('-').map(Number)
                      return new Date(Date.UTC(y, m - 1, day))
                    }),
                  },
                },
              }
            : {}),
          select: {
            recipe: {
              select: {
                title: true,
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

    // Collect raw ingredients from the (possibly filtered) items
    const rawIngredients: Array<{
      name: string
      quantity: number | null
      unit: string | null
      recipe: string
    }> = []

    for (const item of mealPlan.items) {
      const recipeTitle = item.recipe?.title ?? item.customMealName ?? 'Unknown recipe'
      if (item.recipe?.ingredients) {
        for (const ing of item.recipe.ingredients) {
          rawIngredients.push({
            name: ing.ingredientName,
            quantity: ing.quantity ? Number(ing.quantity) : null,
            unit: ing.unit,
            recipe: recipeTitle,
          })
        }
      }
    }

    if (rawIngredients.length === 0) {
      throw new Error(
        'No ingredients found for the selected days. Make sure your meals have recipes with ingredients.'
      )
    }

    // Fetch pantry so the AI can subtract what's already at home
    const pantryResult = await pantryRepository.findAll(userId, { limit: 500 })
    const rawPantry = pantryResult.items.map((p) => ({
      name: p.ingredientName,
      quantity: p.quantity !== null ? Number(p.quantity) : null,
      unit: p.unit,
    }))

    // Get any existing list for this meal plan
    const existingList = await groceryRepository.findByMealPlan(userId, mealPlanId)

    // ── REPLACE MODE (or no existing list) ──────────────────────────────────
    if (mode === 'replace' || !existingList) {
      const filteredItems = await this.runAIPipeline(rawIngredients, rawPantry)

      if (existingList) await groceryRepository.delete(existingList.id)
      const list = await groceryRepository.create(userId, filteredItems, mealPlanId)
      return this.groupByCategory(this.sanitizeList(list))
    }

    // ── MERGE MODE ───────────────────────────────────────────────────────────
    // Token optimisation: ingredients whose normalised name already appears in
    // the existing list skip the AI pipeline and go through rule-based merge
    // only — saving tokens while still summing quantities correctly.
    const existingNormNames = new Set(
      existingList.items.map((i) => this.normalizeIngredientName(i.ingredientName))
    )

    const newRaw = rawIngredients.filter(
      (i) => !existingNormNames.has(this.normalizeIngredientName(i.name))
    )
    const knownRaw = rawIngredients.filter((i) =>
      existingNormNames.has(this.normalizeIngredientName(i.name))
    )

    const itemsToAdd: CreateGroceryItemDTO[] = []

    // New ingredients → full AI pipeline (normalize, merge, subtract pantry)
    if (newRaw.length > 0) {
      const aiItems = await this.runAIPipeline(newRaw, rawPantry)
      itemsToAdd.push(...aiItems)
    }

    // Known ingredients → rule-based merge only (quantity update, no re-subtract)
    if (knownRaw.length > 0) {
      const merged = this.mergeIngredients(
        knownRaw.map((i) => ({ ingredientName: i.name, quantity: i.quantity, unit: i.unit }))
      )
      itemsToAdd.push(...merged)
    }

    if (itemsToAdd.length === 0) {
      throw new Error('No new ingredients to add for the selected days.')
    }

    // Add to existing list — addItem handles dedup + quantity summing per item
    for (const item of itemsToAdd) {
      await this.addItem(userId, existingList.id, item)
    }

    return this.getGroceryListById(existingList.id, userId)
  }

  /**
   * Run the two-stage AI aggregation pipeline.
   * Falls back to rule-based merge + pantry subtraction if AI fails.
   */
  private async runAIPipeline(
    rawIngredients: Array<{ name: string; quantity: number | null; unit: string | null; recipe: string }>,
    rawPantry: Array<{ name: string; quantity: number | null; unit: string | null }>
  ): Promise<CreateGroceryItemDTO[]> {
    try {
      const aiItems = await aggregateGroceryList(rawIngredients, rawPantry)
      if (aiItems.length === 0) {
        throw new Error('Your pantry already covers all the ingredients needed!')
      }
      return aiItems.map((item) => ({
        ingredientName: item.ingredientName,
        quantity: item.quantity ?? undefined,
        unit: item.unit ?? undefined,
        category: item.category,
      }))
    } catch (aiError) {
      if (aiError instanceof Error && aiError.message.includes('pantry already covers')) {
        throw aiError
      }
      // AI aggregation failed — fall back to rule-based merge silently
      const mergedItems = this.mergeIngredients(
        rawIngredients.map((i) => ({ ingredientName: i.name, quantity: i.quantity, unit: i.unit }))
      )
      const subtracted = this.subtractPantryItems(
        mergedItems,
        rawPantry.map((p) => ({ ingredientName: p.name, quantity: p.quantity, unit: p.unit }))
      )
      if (subtracted.length === 0) {
        throw new Error('Your pantry already covers all the ingredients needed!')
      }
      return subtracted
    }
  }

  /**
   * ADD ITEM TO LIST
   * Manually add an item to an existing grocery list.
   *
   * Dedup logic (mirrors mergeIngredients):
   *   - Normalise the incoming name and unit
   *   - Scan every existing item in the list using the same normalisation
   *   - If a match is found AND both entries have quantities → sum quantities
   *   - If a match is found but quantities can't be compared → return existing
   *   - Only insert a new row when there is genuinely no match
   */
  async addItem(
    userId: string,
    groceryListId: string,
    item: CreateGroceryItemDTO
  ): Promise<GroceryItemResponse> {
    const isOwner = await groceryRepository.isOwner(groceryListId, userId)
    if (!isOwner) throw new Error('Grocery list not found or access denied')

    const incomingName = this.normalizeIngredientName(item.ingredientName)
    const incomingUnit = this.normalizeUnit(item.unit)

    // Load all current items so we can check for duplicates
    const existingItems = await groceryRepository.findItemsByList(groceryListId)

    const duplicate = existingItems.find((i) =>
      this.normalizeIngredientName(i.ingredientName) === incomingName &&
      this.normalizeUnit(i.unit) === incomingUnit
    )

    if (duplicate) {
      // Both have numeric quantities — merge them
      if (
        duplicate.quantity !== null &&
        item.quantity !== undefined &&
        item.quantity !== null
      ) {
        const updated = await groceryRepository.updateItem(duplicate.id, {
          quantity: Number(duplicate.quantity) + item.quantity,
        })
        return this.sanitizeItem(updated)
      }
      // Can't merge (missing quantity on one side) — return existing entry as-is
      return this.sanitizeItem(duplicate)
    }

    // No duplicate — create a fresh entry, inferring category if not provided
    const created = await groceryRepository.addItem(groceryListId, {
      ...item,
      ingredientName: item.ingredientName.trim(),
      unit: this.normalizeUnit(item.unit) || item.unit?.trim() || undefined,
      category: item.category ?? this.inferCategory(item.ingredientName),
    })
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
   * DELETE LIST
   * Delete an entire grocery list and all its items
   */
  async deleteList(userId: string, groceryListId: string): Promise<void> {
    const isOwner = await groceryRepository.isOwner(groceryListId, userId)
    if (!isOwner) throw new Error('Grocery list not found or access denied')

    await groceryRepository.delete(groceryListId)
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
  /**
   * SUBTRACT PANTRY ITEMS
   * Removes or reduces grocery items that are already covered by the pantry.
   *
   * Matching strategy: case-insensitive substring match.
   * e.g. "chicken breast" matches "chicken", "Olive Oil" matches "olive oil"
   *
   * Quantity logic:
   * - Pantry item has no quantity → assume sufficient, skip grocery item entirely
   * - Both have quantities + same unit → subtract; only add if remainder > 0
   * - Units differ or grocery has no quantity → keep grocery item (can't compare safely)
   */
  private subtractPantryItems(
    groceryItems: CreateGroceryItemDTO[],
    pantryItems: { ingredientName: string; quantity: number | null; unit: string | null }[]
  ): CreateGroceryItemDTO[] {
    return groceryItems.reduce<CreateGroceryItemDTO[]>((acc, groceryItem) => {
      const groceryName = groceryItem.ingredientName.toLowerCase().trim()

      // Find best pantry match via substring
      const pantryMatch = pantryItems.find((p) => {
        const pantryName = p.ingredientName.toLowerCase().trim()
        return pantryName.includes(groceryName) || groceryName.includes(pantryName)
      })

      // Not in pantry — keep as-is
      if (!pantryMatch) {
        acc.push(groceryItem)
        return acc
      }

      // Pantry has it with no quantity → assume sufficient, skip
      if (pantryMatch.quantity === null) {
        return acc
      }

      // Grocery item has no quantity → can't subtract, keep it
      if (groceryItem.quantity === undefined || groceryItem.quantity === null) {
        acc.push(groceryItem)
        return acc
      }

      // Both have quantities — only subtract if units match (or both are null)
      const unitsMatch =
        (pantryMatch.unit ?? '').toLowerCase().trim() ===
        (groceryItem.unit ?? '').toLowerCase().trim()

      if (!unitsMatch) {
        // Different units — can't safely compare, keep original
        acc.push(groceryItem)
        return acc
      }

      const remainder = groceryItem.quantity - pantryMatch.quantity
      if (remainder > 0) {
        // Still need some — add reduced quantity
        acc.push({ ...groceryItem, quantity: remainder })
      }
      // remainder <= 0 → pantry covers it fully, skip

      return acc
    }, [])
  }

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
