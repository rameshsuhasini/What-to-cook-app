// ─────────────────────────────────────────
// Recipe Repository
//
// All DB operations for recipes live here.
// Uses Prisma transactions where multiple
// writes must succeed or fail together.
// ─────────────────────────────────────────

import { DietType, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import {
  CreateRecipeDTO,
  UpdateRecipeDTO,
  RecipeQueryDTO,
} from '../types/recipe.types'

// ── Full recipe select — always include relations ──
const recipeWithRelations = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  prepTimeMinutes: true,
  cookTimeMinutes: true,
  servings: true,
  calories: true,
  protein: true,
  carbs: true,
  fat: true,
  cuisine: true,
  dietType: true,
  isAiGenerated: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
  ingredients: {
    select: {
      id: true,
      ingredientName: true,
      quantity: true,
      unit: true,
    },
    orderBy: { createdAt: 'asc' as const },
  },
  steps: {
    select: {
      id: true,
      stepNumber: true,
      instructionText: true,
    },
    orderBy: { stepNumber: 'asc' as const },
  },
}

export class RecipeRepository {
  /**
   * Find all recipes with filtering, search, and pagination
   */
  async findAll(query: RecipeQueryDTO, userId?: string) {
    const {
      page = 1,
      limit = 12,
      search,
      dietType,
      cuisine,
      maxCalories,
      minProtein,
      isAiGenerated,
    } = query

    const skip = (page - 1) * limit

    // Build where clause dynamically
    const where: Prisma.RecipeWhereInput = {
      ...(search && {
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { cuisine: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(dietType && { dietType }),
      ...(cuisine && { cuisine: { contains: cuisine, mode: 'insensitive' } }),
      ...(maxCalories && { calories: { lte: maxCalories } }),
      ...(minProtein && { protein: { gte: minProtein } }),
      ...(isAiGenerated !== undefined && { isAiGenerated }),
    }

    // Run count and data queries in parallel for performance
    const [total, recipes] = await Promise.all([
      prisma.recipe.count({ where }),
      prisma.recipe.findMany({
        where,
        select: recipeWithRelations,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ])

    // If user is logged in, fetch their saved recipe IDs to mark isSaved
    let savedRecipeIds = new Set<string>()
    if (userId) {
      const saved = await prisma.savedRecipe.findMany({
        where: { userId },
        select: { recipeId: true },
      })
      savedRecipeIds = new Set(saved.map((s) => s.recipeId))
    }

    return {
      recipes: recipes.map((r) => ({
        ...r,
        ingredients: r.ingredients.map((i) => ({
          ...i,
          quantity: i.quantity ? Number(i.quantity) : null,
        })),
        isSaved: savedRecipeIds.has(r.id),
      })),
      total,
      page,
      limit,
    }
  }

  /**
   * Find a single recipe by ID
   */
  async findById(id: string, userId?: string) {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
      select: recipeWithRelations,
    })

    if (!recipe) return null

    // Check if user has saved this recipe
    let isSaved = false
    if (userId) {
      const saved = await prisma.savedRecipe.findUnique({
        where: { userId_recipeId: { userId, recipeId: id } },
      })
      isSaved = !!saved
    }

    return {
      ...recipe,
      ingredients: recipe.ingredients.map((i) => ({
        ...i,
        quantity: i.quantity ? Number(i.quantity) : null,
      })),
      isSaved,
    }
  }

  /**
   * Create a recipe with ingredients and steps in a transaction
   * Either the whole recipe is created or nothing is — no partial data
   */
  async create(data: CreateRecipeDTO, userId: string, isAiGenerated = false) {
    return prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.create({
        data: {
          title: data.title.trim(),
          description: data.description?.trim(),
          imageUrl: data.imageUrl,
          prepTimeMinutes: data.prepTimeMinutes,
          cookTimeMinutes: data.cookTimeMinutes,
          servings: data.servings,
          calories: data.calories,
          protein: data.protein,
          carbs: data.carbs,
          fat: data.fat,
          cuisine: data.cuisine?.trim(),
          dietType: data.dietType ?? 'NONE',
          isAiGenerated,
          createdByUserId: userId,
          // Create ingredients and steps in the same transaction
          ingredients: {
            create: data.ingredients.map((ing) => ({
              ingredientName: ing.ingredientName.trim(),
              quantity: ing.quantity,
              unit: ing.unit?.trim(),
            })),
          },
          steps: {
            create: data.steps.map((step) => ({
              stepNumber: step.stepNumber,
              instructionText: step.instructionText.trim(),
            })),
          },
        },
        select: recipeWithRelations,
      })

      return {
        ...recipe,
        ingredients: recipe.ingredients.map((i) => ({
          ...i,
          quantity: i.quantity ? Number(i.quantity) : null,
        })),
        isSaved: false,
      }
    })
  }

  /**
   * Update a recipe — replaces ingredients and steps entirely if provided
   * Uses transaction to keep data consistent
   */
  async update(id: string, data: UpdateRecipeDTO) {
    return prisma.$transaction(async (tx) => {
      // If new ingredients provided, replace all existing ones
      if (data.ingredients !== undefined) {
        await tx.recipeIngredient.deleteMany({ where: { recipeId: id } })
      }

      // If new steps provided, replace all existing ones
      if (data.steps !== undefined) {
        await tx.recipeStep.deleteMany({ where: { recipeId: id } })
      }

      const recipe = await tx.recipe.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title.trim() }),
          ...(data.description !== undefined && {
            description: data.description?.trim(),
          }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
          ...(data.prepTimeMinutes !== undefined && {
            prepTimeMinutes: data.prepTimeMinutes,
          }),
          ...(data.cookTimeMinutes !== undefined && {
            cookTimeMinutes: data.cookTimeMinutes,
          }),
          ...(data.servings !== undefined && { servings: data.servings }),
          ...(data.calories !== undefined && { calories: data.calories }),
          ...(data.protein !== undefined && { protein: data.protein }),
          ...(data.carbs !== undefined && { carbs: data.carbs }),
          ...(data.fat !== undefined && { fat: data.fat }),
          ...(data.cuisine !== undefined && {
            cuisine: data.cuisine?.trim(),
          }),
          ...(data.dietType !== undefined && { dietType: data.dietType }),
          ...(data.ingredients && {
            ingredients: {
              create: data.ingredients.map((ing) => ({
                ingredientName: ing.ingredientName.trim(),
                quantity: ing.quantity,
                unit: ing.unit?.trim(),
              })),
            },
          }),
          ...(data.steps && {
            steps: {
              create: data.steps.map((step) => ({
                stepNumber: step.stepNumber,
                instructionText: step.instructionText.trim(),
              })),
            },
          }),
        },
        select: recipeWithRelations,
      })

      return {
        ...recipe,
        ingredients: recipe.ingredients.map((i) => ({
          ...i,
          quantity: i.quantity ? Number(i.quantity) : null,
        })),
      }
    })
  }

  /**
   * Delete a recipe by ID
   * Cascades to ingredients and steps via Prisma schema
   */
  async delete(id: string): Promise<void> {
    await prisma.recipe.delete({ where: { id } })
  }

  /**
   * Save a recipe to user's favourites
   * Uses upsert — safe to call even if already saved
   */
  async saveRecipe(userId: string, recipeId: string) {
    return prisma.savedRecipe.upsert({
      where: { userId_recipeId: { userId, recipeId } },
      update: {}, // no-op if already exists
      create: { userId, recipeId },
    })
  }

  /**
   * Remove a recipe from user's favourites
   */
  async unsaveRecipe(userId: string, recipeId: string): Promise<void> {
    await prisma.savedRecipe.delete({
      where: { userId_recipeId: { userId, recipeId } },
    })
  }

  /**
   * Get all saved recipes for a user
   */
  async getSavedRecipes(userId: string) {
    const saved = await prisma.savedRecipe.findMany({
      where: { userId },
      include: {
        recipe: {
          select: recipeWithRelations,
        },
      },
      orderBy: { savedAt: 'desc' },
    })

    return saved.map((s) => ({
      ...s.recipe,
      ingredients: s.recipe.ingredients.map((i) => ({
        ...i,
        quantity: i.quantity ? Number(i.quantity) : null,
      })),
      isSaved: true,
      savedAt: s.savedAt,
    }))
  }

  /**
   * Find a recipe by exact title (case-insensitive) for a given user.
   * Used by AI meal plan generation to reuse an existing recipe
   * instead of generating a duplicate.
   */
  async findByTitle(title: string, userId: string) {
    return prisma.recipe.findFirst({
      where: {
        title: { equals: title, mode: 'insensitive' },
        createdByUserId: userId,
      },
      select: { id: true, title: true },
    })
  }

  /**
   * Get all recipe titles created by a user.
   * Injected into the meal plan AI prompt so it can prefer
   * dishes the user already has in their library.
   */
  async findAllTitles(userId: string): Promise<string[]> {
    const recipes = await prisma.recipe.findMany({
      where: { createdByUserId: userId },
      select: { title: true },
      orderBy: { createdAt: 'desc' },
    })
    return recipes.map((r) => r.title)
  }

  /**
   * Check if a recipe belongs to a user
   * Used to authorise update/delete operations
   */
  async isOwner(recipeId: string, userId: string): Promise<boolean> {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { createdByUserId: true },
    })
    return recipe?.createdByUserId === userId
  }
}

export default new RecipeRepository()
