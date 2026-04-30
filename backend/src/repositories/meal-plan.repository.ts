// ─────────────────────────────────────────
// Meal Plan Repository
//
// All DB operations for meal plans live here.
// ─────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { CreateMealPlanItemDTO, UpdateMealPlanItemDTO } from '../types/meal-plan.types'

// ── Recipe summary select — only what's needed for meal plan view ──
const recipeMinimal = {
  id: true,
  title: true,
  imageUrl: true,
  prepTimeMinutes: true,
  cookTimeMinutes: true,
  calories: true,
  protein: true,
  carbs: true,
  fat: true,
  servings: true,
}

// ── Full meal plan item select ──
const mealPlanItemSelect = {
  id: true,
  mealPlanId: true,
  date: true,
  mealType: true,
  recipeId: true,
  customMealName: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  recipe: { select: recipeMinimal },
}

// ── Full meal plan select ──
const mealPlanSelect = {
  id: true,
  userId: true,
  weekStartDate: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: mealPlanItemSelect,
    orderBy: [
      { date: 'asc' as const },
      { mealType: 'asc' as const },
    ],
  },
}

export class MealPlanRepository {
  /**
   * Find a meal plan by week start date for a user
   * Returns null if none exists for that week
   */
  async findByWeek(userId: string, weekStartDate: Date) {
    return prisma.mealPlan.findUnique({
      where: {
        userId_weekStartDate: { userId, weekStartDate },
      },
      select: mealPlanSelect,
    })
  }

  /**
   * Find a meal plan by ID
   */
  async findById(id: string) {
    return prisma.mealPlan.findUnique({
      where: { id },
      select: mealPlanSelect,
    })
  }

  /**
   * Create a new meal plan for a week
   * Optionally creates items in the same transaction
   */
  async create(userId: string, weekStartDate: Date, items?: CreateMealPlanItemDTO[]) {
    return prisma.mealPlan.create({
      data: {
        userId,
        weekStartDate,
        ...(items && items.length > 0 && {
          items: {
            create: items.map((item) => ({
              date: new Date(item.date),
              mealType: item.mealType,
              recipeId: item.recipeId ?? null,
              customMealName: item.customMealName ?? null,
              notes: item.notes ?? null,
            })),
          },
        }),
      },
      select: mealPlanSelect,
    })
  }

  /**
   * Add a single meal item to an existing meal plan.
   * Uses delete-then-create within a transaction so that the same
   * (mealPlanId, date, mealType) slot can never hold two rows.
   * This prevents the "delete reveals a ghost item" bug when the AI
   * is run more than once or a manual meal pre-existed in the slot.
   */
  async addItem(mealPlanId: string, item: CreateMealPlanItemDTO) {
    const date = new Date(item.date)
    return prisma.$transaction(async (tx) => {
      const existing = await tx.mealPlanItem.findFirst({
        where: { mealPlanId, date, mealType: item.mealType },
        select: { id: true, recipeId: true },
      })

      // Preserve slots that already have a linked recipe — don't wipe real recipes
      // with AI-generated custom meal names when the user re-runs generation.
      if (existing?.recipeId) {
        return tx.mealPlanItem.findUniqueOrThrow({
          where: { id: existing.id },
          select: mealPlanItemSelect,
        })
      }

      // Replace any existing custom meal slot with new AI content
      if (existing) {
        await tx.mealPlanItem.delete({ where: { id: existing.id } })
      }

      return tx.mealPlanItem.create({
        data: {
          mealPlanId,
          date,
          mealType: item.mealType,
          recipeId: item.recipeId ?? null,
          customMealName: item.customMealName ?? null,
          notes: item.notes ?? null,
        },
        select: mealPlanItemSelect,
      })
    })
  }

  /**
   * Update a meal plan item
   */
  async updateItem(id: string, data: UpdateMealPlanItemDTO) {
    return prisma.mealPlanItem.update({
      where: { id },
      data: {
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.mealType !== undefined && { mealType: data.mealType }),
        ...(data.recipeId !== undefined && { recipeId: data.recipeId }),
        ...(data.customMealName !== undefined && { customMealName: data.customMealName }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      select: mealPlanItemSelect,
    })
  }

  /**
   * Delete a single meal plan item
   */
  async deleteItem(id: string): Promise<void> {
    await prisma.mealPlanItem.delete({ where: { id } })
  }

  /**
   * Delete an entire meal plan and all its items
   * Items cascade via Prisma schema
   */
  async delete(id: string): Promise<void> {
    await prisma.mealPlan.delete({ where: { id } })
  }

  /**
   * Find a meal plan item by ID
   * Used for ownership checks and updates
   */
  async findItemById(id: string) {
    return prisma.mealPlanItem.findUnique({
      where: { id },
      select: {
        ...mealPlanItemSelect,
        mealPlan: {
          select: { userId: true, id: true },
        },
      },
    })
  }

  /**
   * Check if a meal plan belongs to a user
   */
  async isOwner(mealPlanId: string, userId: string): Promise<boolean> {
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      select: { userId: true },
    })
    return plan?.userId === userId
  }
}

export default new MealPlanRepository()
