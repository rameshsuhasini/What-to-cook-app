'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Calendar } from 'lucide-react'
import { WeekView } from '@/services/meal-plan.service'
import { profileApi, UserProfile } from '@/services/profile.service'

// ── Types ─────────────────────────────────────────────────

interface NutritionProgressRingsProps {
  weekView: WeekView | undefined
}

interface MacroBarProps {
  emoji: string
  label: string
  value: number
  unit: string
  goal: number
  color: string   // CSS variable string e.g. 'var(--coral-400)'
  bgColor: string // CSS variable string e.g. 'var(--coral-50)'
}

// ── Helpers ───────────────────────────────────────────────

function getPillStyle(pct: number): { bg: string; color: string } {
  if (pct >= 80 && pct <= 110) return { bg: 'var(--teal-50)',   color: 'var(--teal-600)'  }
  if ((pct >= 60 && pct < 80) || (pct > 110 && pct <= 130))
    return { bg: 'var(--amber-50)',  color: 'var(--amber-600)' }
  return                              { bg: 'var(--coral-50)',  color: 'var(--coral-600)' }
}

// ── MacroBar ──────────────────────────────────────────────

function MacroBar({ emoji, label, value, unit, goal, color, bgColor }: MacroBarProps) {
  const rawPct  = goal > 0 ? (value / goal) * 100 : 0
  const pct     = Math.round(rawPct)
  const barPct  = Math.min(100, pct)
  const pill    = getPillStyle(pct)
  const displayVal  = Math.round(value).toLocaleString()
  const displayGoal = Math.round(goal).toLocaleString()

  return (
    <div className="macro-bar-row">
      {/* Left: emoji + label */}
      <div className="macro-bar-label">
        <span className="macro-bar-emoji">{emoji}</span>
        <span className="macro-bar-name">{label}</span>
      </div>

      {/* Center: track + animated fill */}
      <div className="macro-bar-track">
        <motion.div
          className="macro-bar-fill"
          style={{ background: color }}
          initial={{ width: '0%' }}
          animate={{ width: `${barPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' as const }}
        />
      </div>

      {/* Right: value + goal */}
      <div className="macro-bar-meta">
        <span className="macro-bar-value" style={{ color }}>
          {displayVal}
          <span className="macro-bar-unit"> {unit}</span>
        </span>
        <span className="macro-bar-goal">/ {displayGoal} {unit}</span>
      </div>

      {/* Pill */}
      <span
        className="macro-bar-pill"
        style={{ background: pill.bg, color: pill.color }}
      >
        {pct}%
      </span>
    </div>
  )
}

// ── NutritionProgressRings (now macro bars) ───────────────

export function NutritionProgressRings({ weekView }: NutritionProgressRingsProps) {
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  })

  const goals = {
    calories: profile?.calorieGoal ?? 2000,
    protein:  profile?.proteinGoal ?? 150,
    carbs:    profile?.carbGoal    ?? 200,
    fat:      profile?.fatGoal     ?? 65,
  }

  let totalCals = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0
  let hasMeals = false

  if (weekView?.days) {
    for (const day of weekView.days) {
      for (const item of [day.breakfast, day.lunch, day.dinner, day.snack]) {
        if (item?.recipe) {
          hasMeals      = true
          totalCals    += item.recipe.calories ?? 0
          totalProtein += item.recipe.protein  ?? 0
          totalCarbs   += item.recipe.carbs    ?? 0
          totalFat     += item.recipe.fat      ?? 0
        }
      }
    }
  }

  const dailyCals    = totalCals    / 7
  const dailyProtein = totalProtein / 7
  const dailyCarbs   = totalCarbs   / 7
  const dailyFat     = totalFat     / 7

  return (
    <div className="nutrition-rings-card">
      <div className="nutrition-rings-header">
        <div className="nutrition-rings-title">
          <Calendar size={14} />
          Planned Daily Average
        </div>
        <div className="nutrition-rings-subtitle">Estimated from this week's meal plan — not your logged intake</div>
      </div>

      {!hasMeals ? (
        <div className="nutrition-empty">
          Plan your meals above to see nutrition estimates
        </div>
      ) : (
        <div className="macro-bars-list">
          <MacroBar
            emoji="🔥" label="Calories"
            value={dailyCals}    unit="kcal" goal={goals.calories}
            color="var(--coral-400)" bgColor="var(--coral-50)"
          />
          <MacroBar
            emoji="💪" label="Protein"
            value={dailyProtein} unit="g"    goal={goals.protein}
            color="var(--teal-400)"  bgColor="var(--teal-50)"
          />
          <MacroBar
            emoji="🌾" label="Carbs"
            value={dailyCarbs}   unit="g"    goal={goals.carbs}
            color="var(--amber-400)" bgColor="var(--amber-50)"
          />
          <MacroBar
            emoji="💧" label="Fat"
            value={dailyFat}     unit="g"    goal={goals.fat}
            color="var(--blue-400)"  bgColor="var(--blue-50)"
          />
        </div>
      )}
    </div>
  )
}
