// ─────────────────────────────────────────
// Health Insights AI
//
// Analyses user's health data and provides:
// - Weight trend insights
// - Nutrition analysis
// - Personalised recommendations
// - Weekly goals
// ─────────────────────────────────────────

import { sendAIMessageJSON, TOKEN_LIMITS, JSON_INSTRUCTION } from './aiService'
import {
  UserContext,
  GenerateHealthInsightsDTO,
  AIHealthInsights,
} from './types/ai.types'
import { WeightTrend, NutritionSummary } from '../types/health.types'

const buildSystemPrompt = (user: UserContext): string => `
You are a caring, knowledgeable health and nutrition coach AI for the "What to Cook?" app.
You analyse health data and provide personalised, actionable, and encouraging insights.

USER PROFILE:
- Name: ${user.name}
- Diet Type: ${user.dietType}
- Health Conditions: ${user.healthConditions || 'None'}
- Allergies: ${user.allergies || 'None'}
- Daily Calorie Goal: ${user.calorieGoal ? `${user.calorieGoal} kcal` : 'Not set'}
- Protein Goal: ${user.proteinGoal ? `${user.proteinGoal}g` : 'Not set'}
- Carb Goal: ${user.carbGoal ? `${user.carbGoal}g` : 'Not set'}
- Fat Goal: ${user.fatGoal ? `${user.fatGoal}g` : 'Not set'}
- Current Weight: ${user.currentWeightKg ? `${user.currentWeightKg}kg` : 'Not set'}
- Target Weight: ${user.targetWeightKg ? `${user.targetWeightKg}kg` : 'Not set'}

COACHING RULES:
- Be encouraging and positive — never shame or criticise
- Be specific and actionable — vague advice is useless
- Reference actual data from the user's logs
- Acknowledge progress, even small wins
- If no data available for a section, say so kindly
- Keep health conditions in mind when making recommendations
- Never give medical advice — recommend consulting a doctor for medical concerns

${JSON_INSTRUCTION}

Respond with this exact JSON schema:
{
  "overview": "string (2-3 sentence personalised overview)",
  "weightInsights": "string or null (weight trend analysis, null if no weight data)",
  "nutritionInsights": "string or null (nutrition analysis, null if no nutrition data)",
  "recommendations": ["string (3-5 specific, actionable recommendations)"],
  "weeklyGoals": ["string (2-3 achievable goals for this week)"],
  "motivationalMessage": "string (short, personalised encouraging message)"
}
`

const buildUserMessage = (
  user: UserContext,
  weightTrend?: WeightTrend,
  nutritionSummary?: NutritionSummary
): string => {
  const parts = [`Analyse ${user.name}'s health data and provide personalised insights.`]

  if (weightTrend && weightTrend.logs.length > 0) {
    const { stats } = weightTrend
    parts.push(`
WEIGHT DATA (last ${weightTrend.logs.length} entries):
- Current weight: ${stats.current}kg
- Starting weight: ${stats.starting}kg
- Total change: ${stats.totalChange}kg
- Lowest: ${stats.lowest}kg
- Highest: ${stats.highest}kg
- Average weekly change: ${stats.averagePerWeek}kg/week
    `)
  } else {
    parts.push('WEIGHT DATA: No weight logs recorded yet.')
  }

  if (nutritionSummary && nutritionSummary.logs.length > 0) {
    const { averages, today } = nutritionSummary
    parts.push(`
NUTRITION DATA (last ${nutritionSummary.logs.length} days average):
- Average calories: ${averages.calories} kcal (goal: ${user.calorieGoal || 'not set'})
- Average protein: ${averages.protein}g (goal: ${user.proteinGoal || 'not set'}g)
- Average carbs: ${averages.carbs}g (goal: ${user.carbGoal || 'not set'}g)
- Average fat: ${averages.fat}g (goal: ${user.fatGoal || 'not set'}g)
${today ? `Today's intake: ${today.calories} kcal, ${today.protein}g protein, ${today.carbs}g carbs, ${today.fat}g fat` : 'No nutrition logged today yet.'}
    `)
  } else {
    parts.push('NUTRITION DATA: No nutrition logs recorded yet.')
  }

  return parts.join('\n')
}

const validateInsights = (insights: any): AIHealthInsights => {
  const required = ['overview', 'recommendations', 'weeklyGoals', 'motivationalMessage']
  for (const field of required) {
    if (!insights[field]) {
      throw new Error(`AI health insights missing field: ${field}`)
    }
  }

  return {
    overview: insights.overview,
    weightInsights: insights.weightInsights || null,
    nutritionInsights: insights.nutritionInsights || null,
    recommendations: Array.isArray(insights.recommendations)
      ? insights.recommendations
      : [],
    weeklyGoals: Array.isArray(insights.weeklyGoals) ? insights.weeklyGoals : [],
    motivationalMessage: insights.motivationalMessage,
  }
}

export const generateHealthInsights = async (
  user: UserContext,
  weightTrend?: WeightTrend,
  nutritionSummary?: NutritionSummary
): Promise<AIHealthInsights> => {
  const insights = await sendAIMessageJSON<AIHealthInsights>({
    systemPrompt: buildSystemPrompt(user),
    userMessage: buildUserMessage(user, weightTrend, nutritionSummary),
    maxTokens: TOKEN_LIMITS.healthInsights,
  })

  return validateInsights(insights)
}
