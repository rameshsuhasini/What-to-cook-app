import notificationRepository from '../repositories/notification.repository'
import { ACHIEVEMENT_MAP } from '../lib/achievements'

// Checks if a user has earned the given achievement key.
// If not already unlocked, creates the achievement + notification records.
// Returns the achievement definition if newly unlocked, null otherwise.
async function unlock(userId: string, key: string) {
  const alreadyUnlocked = await notificationRepository.hasAchievement(userId, key)
  if (alreadyUnlocked) return null

  const def = ACHIEVEMENT_MAP.get(key)
  if (!def) return null

  await notificationRepository.createAchievement(userId, key)
  await notificationRepository.create(userId, 'ACHIEVEMENT', def.title, def.message)

  return def
}

// ── Trigger helpers ─────────────────────────────────────────
// Called from controllers after relevant user actions.

export const achievementService = {
  async onRecipeSaved(userId: string, totalSaved: number) {
    await unlock(userId, 'FIRST_RECIPE_SAVED')
    if (totalSaved >= 10) await unlock(userId, 'RECIPES_SAVED_10')
  },

  async onAiRecipeGenerated(userId: string) {
    await unlock(userId, 'FIRST_AI_RECIPE')
  },

  async onRecipeImported(userId: string) {
    await unlock(userId, 'FIRST_RECIPE_IMPORTED')
  },

  async onMealPlanCreated(userId: string, totalPlans: number) {
    await unlock(userId, 'FIRST_MEAL_PLAN')
    if (totalPlans >= 4) await unlock(userId, 'MEAL_PLANS_4')
  },

  async onGroceryListCreated(userId: string) {
    await unlock(userId, 'FIRST_GROCERY_LIST')
  },

  async onPantryItemAdded(userId: string) {
    await unlock(userId, 'FIRST_PANTRY_ITEM')
  },

  async onWeightLogged(userId: string, totalLogs: number) {
    await unlock(userId, 'FIRST_WEIGHT_LOG')
    if (totalLogs >= 7) await unlock(userId, 'WEIGHT_LOGS_7')
  },

  async onNutritionLogged(userId: string, totalLogs: number) {
    await unlock(userId, 'FIRST_NUTRITION_LOG')
    if (totalLogs >= 7) await unlock(userId, 'NUTRITION_LOGS_7')
  },
}
