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
   * Bulk create/merge multiple pantry items without an interactive transaction.
   *
   * Why no interactive transaction:
   *   The old approach ran findFirst + create/update sequentially inside
   *   $transaction(async tx => { for... }), which is one DB round-trip per
   *   item. On Neon serverless the proxy latency makes this exceed the 5 s
   *   transaction timeout for lists of 20+ items.
   *
   * Strategy (3 DB round-trips total, regardless of list size):
   *   1. findMany  — load all existing pantry items for this user
   *   2. createMany — insert genuinely new items in one statement
   *   3. $transaction([...updates]) — batch all updates in one round-trip
   */
  async bulkCreate(userId: string, items: CreatePantryItemDTO[]) {
    if (items.length === 0) return []

    // ── Round-trip 1: load all existing items ──────────────────────────────
    const existingItems = await prisma.pantryItem.findMany({
      where: { userId },
      select: pantryItemSelect,
    })

    // Build a normalised map for case-insensitive dedup
    const existingMap = new Map(
      existingItems.map((e) => [e.ingredientName.toLowerCase().trim(), e])
    )

    // Deduplicate the input against itself (later entries win)
    const dedupedInput = new Map<string, CreatePantryItemDTO>()
    for (const item of items) {
      dedupedInput.set(item.ingredientName.toLowerCase().trim(), item)
    }

    const toCreate: CreatePantryItemDTO[] = []
    const toUpdate: Array<{ id: string; quantity: number | null; unit: string | null }> = []

    for (const item of dedupedInput.values()) {
      const key = item.ingredientName.toLowerCase().trim()
      const found = existingMap.get(key)

      if (found) {
        // Merge: update quantity only when one is provided
        if (item.quantity !== undefined) {
          toUpdate.push({
            id: found.id,
            quantity: item.quantity,
            unit: item.unit?.trim() ?? found.unit,
          })
        }
      } else {
        toCreate.push(item)
      }
    }

    // ── Round-trips 2 & 3 in parallel ─────────────────────────────────────
    const [updatedItems, createdItems] = await Promise.all([
      // Round-trip 2: all updates in one array-form transaction
      toUpdate.length > 0
        ? prisma.$transaction(
            toUpdate.map((u) =>
              prisma.pantryItem.update({
                where: { id: u.id },
                data: { quantity: u.quantity, unit: u.unit },
                select: pantryItemSelect,
              })
            )
          )
        : Promise.resolve([] as typeof existingItems),

      // Round-trip 3a: create all new items; 3b: fetch them back (createMany
      // doesn't return rows in Prisma)
      toCreate.length > 0
        ? prisma.pantryItem
            .createMany({
              data: toCreate.map((i) => ({
                userId,
                ingredientName: i.ingredientName.trim(),
                quantity: i.quantity ?? null,
                unit: i.unit?.trim() ?? null,
              })),
              skipDuplicates: true,
            })
            .then(() =>
              prisma.pantryItem.findMany({
                where: {
                  userId,
                  ingredientName: { in: toCreate.map((i) => i.ingredientName.trim()) },
                },
                select: pantryItemSelect,
              })
            )
        : Promise.resolve([] as typeof existingItems),
    ])

    return [...updatedItems, ...createdItems]
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
   * Strip common descriptive adjectives from an ingredient name
   * so that "ripe avocado" and "avocado" share the same core.
   */
  private stripAdjectives(name: string): string {
    const ADJECTIVES = new Set([
      'ripe', 'fresh', 'raw', 'frozen', 'dried', 'whole', 'organic',
      'baby', 'large', 'small', 'medium', 'chopped', 'sliced', 'diced',
      'minced', 'grated', 'peeled', 'cooked', 'roasted', 'grilled',
      'canned', 'tinned', 'ground', 'crushed', 'shredded', 'boneless',
      'skinless', 'lean', 'extra', 'virgin', 'pure', 'plain', 'low',
      'fat', 'free', 'reduced', 'full', 'half', 'unsalted', 'salted',
    ])
    return name
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter((w) => !ADJECTIVES.has(w))
      .join(' ')
      .trim()
  }

  /**
   * Find pantry items whose name is similar to the given name.
   * Catches cases like "avocado" vs "ripe avocado" and
   * "chicken" vs "chicken breast".
   * Excludes exact matches — those are handled by the duplicate check.
   */
  async findSimilar(userId: string, name: string) {
    const all = await prisma.pantryItem.findMany({
      where: { userId },
      select: pantryItemSelect,
    })

    const nameLower = name.toLowerCase().trim()
    const nameStripped = this.stripAdjectives(name)

    return all.filter((item) => {
      const existingLower = item.ingredientName.toLowerCase().trim()
      // Skip exact match — already handled by duplicate prevention
      if (existingLower === nameLower) return false

      const existingStripped = this.stripAdjectives(item.ingredientName)

      // Core match: same after stripping adjectives (e.g. "avocado" === "avocado")
      if (nameStripped && existingStripped && nameStripped === existingStripped) return true

      // Containment: one name fully contains the other
      if (nameLower.includes(existingLower) || existingLower.includes(nameLower)) return true

      return false
    })
  }

  /**
   * Merge two pantry items: sums their quantities and keeps one record.
   * The "merge" item is deleted; the "keep" item is updated with the total.
   */
  async mergeItems(keepId: string, mergeId: string) {
    return prisma.$transaction(async (tx) => {
      const [keep, merge] = await Promise.all([
        tx.pantryItem.findUnique({ where: { id: keepId }, select: pantryItemSelect }),
        tx.pantryItem.findUnique({ where: { id: mergeId }, select: pantryItemSelect }),
      ])

      if (!keep || !merge) throw new Error('One or both items not found')

      // Sum quantities only when both have a value; otherwise keep whichever exists
      const newQty =
        keep.quantity !== null && merge.quantity !== null
          ? Number(keep.quantity) + Number(merge.quantity)
          : keep.quantity !== null
          ? Number(keep.quantity)
          : merge.quantity !== null
          ? Number(merge.quantity)
          : null

      await tx.pantryItem.delete({ where: { id: mergeId } })

      return tx.pantryItem.update({
        where: { id: keepId },
        data: { quantity: newQty },
        select: pantryItemSelect,
      })
    })
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
