// Static definitions for all possible achievements.
// achievementKey must be unique and never renamed once live (it's the DB key).

export interface AchievementDefinition {
  key: string
  title: string
  message: string
  emoji: string
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  // ── Recipe achievements ────────────────────────────
  {
    key: 'FIRST_RECIPE_SAVED',
    title: 'Recipe Hoarder',
    message: 'You saved your first recipe. Your collection begins! 📌',
    emoji: '❤️',
  },
  {
    key: 'FIRST_AI_RECIPE',
    title: 'AI Chef',
    message: 'You generated your first AI recipe. The future of cooking is here!',
    emoji: '🤖',
  },
  {
    key: 'FIRST_RECIPE_IMPORTED',
    title: 'Recipe Detective',
    message: 'You imported your first recipe from a URL. Nice find!',
    emoji: '🔗',
  },
  {
    key: 'RECIPES_SAVED_10',
    title: 'Collector',
    message: 'You saved 10 recipes. Are you building a cookbook?',
    emoji: '📚',
  },

  // ── Meal plan achievements ─────────────────────────
  {
    key: 'FIRST_MEAL_PLAN',
    title: 'Planner',
    message: 'You created your first weekly meal plan. Future you is grateful.',
    emoji: '📅',
  },
  {
    key: 'MEAL_PLANS_4',
    title: 'Consistent Planner',
    message: 'Four weeks of meal planning. You\'re basically a nutritionist now.',
    emoji: '🏆',
  },

  // ── Grocery achievements ───────────────────────────
  {
    key: 'FIRST_GROCERY_LIST',
    title: 'Shopper',
    message: 'You generated your first grocery list. No more wandering the aisles!',
    emoji: '🛒',
  },

  // ── Pantry achievements ────────────────────────────
  {
    key: 'FIRST_PANTRY_ITEM',
    title: 'Pantry Builder',
    message: 'You added your first pantry item. Stock it up!',
    emoji: '🧺',
  },

  // ── Progress achievements ──────────────────────────
  {
    key: 'FIRST_WEIGHT_LOG',
    title: 'Self Aware',
    message: 'You logged your first weight. Awareness is the first step!',
    emoji: '⚖️',
  },
  {
    key: 'WEIGHT_LOGS_7',
    title: 'Consistent',
    message: 'Seven weight logs in the bag. You\'re on a roll!',
    emoji: '🔥',
  },
  {
    key: 'FIRST_NUTRITION_LOG',
    title: 'Macro Tracker',
    message: 'You logged your first nutrition entry. Know what you eat!',
    emoji: '🥗',
  },
  {
    key: 'NUTRITION_LOGS_7',
    title: 'Nutrition Nerd',
    message: 'Seven days of nutrition logging. Science approves.',
    emoji: '🧪',
  },
]

export const ACHIEVEMENT_MAP = new Map<string, AchievementDefinition>(
  ACHIEVEMENTS.map((a) => [a.key, a])
)
