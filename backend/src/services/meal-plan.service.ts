// ─────────────────────────────────────────
// Meal Plan Service
//
// Business logic for meal planning:
// - Week date normalisation (always Monday)
// - Building the 7-day week view
// - Ownership checks before mutations
// - Upsert behaviour for weekly plans
// ─────────────────────────────────────────

import mealPlanRepository from '../repositories/meal-plan.repository'
import {
  CreateMealPlanDTO,
  CreateMealPlanItemDTO,
  UpdateMealPlanItemDTO,
  MealPlanResponse,
  WeekViewResponse,
  WeekDayMeals,
  MealPlanItemResponse,
} from '../types/meal-plan.types'

export class MealPlanService {
  // ── Date helpers ─────────────────────────

  /**
   * Normalise any date to the Monday of its week
   * The weekly planner always anchors to Monday
   */
  private getMondayOfWeek(date: Date): Date {
    const d = new Date(date)
    d.setUTCHours(0, 0, 0, 0)
    const day = d.getUTCDay() // 0 = Sunday, 1 = Monday ...
    const diff = day === 0 ? -6 : 1 - day // go back to Monday
    d.setUTCDate(d.getUTCDate() + diff)
    return d
  }

  /**
   * Get the Sunday end date from a Monday start date
   */
  private getSundayOfWeek(monday: Date): Date {
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)
    return sunday
  }

  /**
   * Generate all 7 ISO date strings for a week
   * starting from Monday
   */
  private getWeekDates(monday: Date): string[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setUTCDate(monday.getUTCDate() + i)
      return d.toISOString().split('T')[0]
    })
  }

  /**
   * Build the structured week view — 7 days each
   * with breakfast/lunch/dinner/snack slots
   */
  private buildWeekView(
    items: MealPlanItemResponse[],
    weekDates: string[]
  ): WeekDayMeals[] {
    return weekDates.map((dateStr) => {
      const dayItems = items.filter(
        (item) => new Date(item.date).toISOString().split('T')[0] === dateStr
      )

      const getSlot = (mealType: string) =>
        dayItems.find((i) => i.mealType === mealType) ?? null

      return {
        date: dateStr,
        breakfast: getSlot('BREAKFAST'),
        lunch: getSlot('LUNCH'),
        dinner: getSlot('DINNER'),
        snack: getSlot('SNACK'),
      }
    })
  }

  // ── Service methods ──────────────────────

  /**
   * GET WEEK VIEW
   * Returns the full 7-day structured view for a given week.
   * If no meal plan exists yet, returns an empty week structure
   * so the frontend can render empty slots without extra logic.
   */
  async getWeekView(userId: string, dateParam?: string): Promise<WeekViewResponse> {
    const baseDate = dateParam ? new Date(dateParam) : new Date()

    if (isNaN(baseDate.getTime())) {
      throw new Error('Invalid date provided')
    }

    const monday = this.getMondayOfWeek(baseDate)
    const sunday = this.getSundayOfWeek(monday)
    const weekDates = this.getWeekDates(monday)

    const mealPlan = await mealPlanRepository.findByWeek(userId, monday)

    return {
      mealPlan: mealPlan as MealPlanResponse | null,
      weekStartDate: monday.toISOString().split('T')[0],
      weekEndDate: sunday.toISOString().split('T')[0],
      days: this.buildWeekView(
        mealPlan ? (mealPlan.items as MealPlanItemResponse[]) : [],
        weekDates
      ),
    }
  }

  /**
   * CREATE OR GET MEAL PLAN
   * Upsert behaviour — if a plan already exists for the week,
   * return it. Otherwise create a new one.
   * This prevents duplicate plans for the same week.
   */
  async createMealPlan(
    userId: string,
    data: CreateMealPlanDTO
  ): Promise<MealPlanResponse> {
    const weekStartDate = new Date(data.weekStartDate)

    if (isNaN(weekStartDate.getTime())) {
      throw new Error('Invalid weekStartDate')
    }

    // Always normalise to Monday — prevents bad data
    const monday = this.getMondayOfWeek(weekStartDate)

    // Check if plan already exists for this week
    const existing = await mealPlanRepository.findByWeek(userId, monday)
    if (existing) {
      return existing as MealPlanResponse
    }

    const plan = await mealPlanRepository.create(userId, monday, data.items)
    return plan as MealPlanResponse
  }

  /**
   * ADD MEAL ITEM
   * Adds a single meal to an existing plan.
   * Auto-creates the week plan if one doesn't exist yet.
   */
  async addMealItem(
    userId: string,
    mealPlanId: string,
    item: CreateMealPlanItemDTO
  ): Promise<MealPlanItemResponse> {
    // Verify plan exists and belongs to user
    const isOwner = await mealPlanRepository.isOwner(mealPlanId, userId)
    if (!isOwner) {
      throw new Error('Meal plan not found or access denied')
    }

    // Validate date is within plan's week
    const plan = await mealPlanRepository.findById(mealPlanId)
    if (!plan) {
      throw new Error('Meal plan not found')
    }

    const itemDate = new Date(item.date)
    const planMonday = new Date(plan.weekStartDate)
    const planSunday = this.getSundayOfWeek(planMonday)

    if (itemDate < planMonday || itemDate > planSunday) {
      throw new Error('Meal item date must be within the plan week')
    }

    // Must have either a recipeId or a customMealName
    if (!item.recipeId && !item.customMealName) {
      throw new Error('Meal item must have either a recipe or a custom meal name')
    }

    const newItem = await mealPlanRepository.addItem(mealPlanId, item)
    return newItem as MealPlanItemResponse
  }

  /**
   * UPDATE MEAL ITEM
   * Updates a single meal slot — e.g. change recipe or notes
   */
  async updateMealItem(
    userId: string,
    itemId: string,
    data: UpdateMealPlanItemDTO
  ): Promise<MealPlanItemResponse> {
    const item = await mealPlanRepository.findItemById(itemId)

    if (!item) {
      throw new Error('Meal plan item not found')
    }

    // Check ownership via the parent meal plan
    if ((item as any).mealPlan?.userId !== userId) {
      throw new Error('Access denied')
    }

    const updated = await mealPlanRepository.updateItem(itemId, data)
    return updated as MealPlanItemResponse
  }

  /**
   * DELETE MEAL ITEM
   * Removes a single meal from its slot
   */
  async deleteMealItem(userId: string, itemId: string): Promise<void> {
    const item = await mealPlanRepository.findItemById(itemId)

    if (!item) {
      throw new Error('Meal plan item not found')
    }

    if ((item as any).mealPlan?.userId !== userId) {
      throw new Error('Access denied')
    }

    await mealPlanRepository.deleteItem(itemId)
  }

  /**
   * DELETE MEAL PLAN
   * Deletes the entire week plan and all its items
   */
  async deleteMealPlan(userId: string, mealPlanId: string): Promise<void> {
    const isOwner = await mealPlanRepository.isOwner(mealPlanId, userId)

    if (!isOwner) {
      throw new Error('Meal plan not found or access denied')
    }

    await mealPlanRepository.delete(mealPlanId)
  }
}

export default new MealPlanService()
