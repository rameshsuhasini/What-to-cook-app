'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { CalendarDays } from 'lucide-react'
import { WeekDay, WeekView, MealPlanItem } from '@/services/meal-plan.service'
import { profileApi, UserProfile } from '@/services/profile.service'

// ── Types ─────────────────────────────────────────────────

interface NutritionProgressRingsProps {
  weekView: WeekView | undefined
}

interface DayMacros {
  cal: number
  p: number
  c: number
  f: number
  hasAny: boolean
}

// ── Helpers ───────────────────────────────────────────────

const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// Parses estimated macros from the notes field written by the AI meal plan generator.
// Format: "Description (~420 kcal | P:30g C:50g F:15g)"
const NOTES_RE = /\(~?(\d+)\s*kcal\s*\|\s*P:(\d+)g\s+C:(\d+)g\s+F:(\d+)g\)/

function extractMacros(item: MealPlanItem | null): { cal: number; p: number; c: number; f: number } {
  if (!item) return { cal: 0, p: 0, c: 0, f: 0 }

  if (item.recipe) {
    return {
      cal: item.recipe.calories ?? 0,
      p:   item.recipe.protein  ?? 0,
      c:   item.recipe.carbs    ?? 0,
      f:   item.recipe.fat      ?? 0,
    }
  }

  if (item.notes) {
    const m = item.notes.match(NOTES_RE)
    if (m) return { cal: +m[1], p: +m[2], c: +m[3], f: +m[4] }
  }

  return { cal: 0, p: 0, c: 0, f: 0 }
}

function getDayMacros(day: WeekDay): DayMacros {
  const slots = [day.breakfast, day.lunch, day.dinner, day.snack]
  let cal = 0, p = 0, c = 0, f = 0, hasAny = false

  for (const item of slots) {
    if (!item) continue
    hasAny = true
    const m = extractMacros(item)
    cal += m.cal; p += m.p; c += m.c; f += m.f
  }

  return { cal, p, c, f, hasAny }
}

function formatDayLabel(dateStr: string): { name: string; date: string } {
  // Append noon to avoid UTC-offset date shifting
  const d = new Date(dateStr + 'T12:00:00')
  return {
    name: DAY_NAMES[d.getDay()],
    date: `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`,
  }
}

function barColor(pct: number): string {
  if (pct > 110) return 'var(--coral-400)'
  if (pct >= 85)  return 'var(--teal-400)'
  return 'var(--amber-400)'
}

// ── NutritionProgressRings ────────────────────────────────

export function NutritionProgressRings({ weekView }: NutritionProgressRingsProps) {
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  })

  const calGoal = profile?.calorieGoal ?? 2000

  const days = weekView?.days ?? []

  const dayData = days.map((day) => ({
    label: formatDayLabel(day.date),
    macros: getDayMacros(day),
  }))

  const plannedDays   = dayData.filter((d) => d.macros.hasAny)
  const totalCal      = plannedDays.reduce((sum, d) => sum + d.macros.cal, 0)
  const avgCal        = plannedDays.length > 0 ? Math.round(totalCal / plannedDays.length) : 0
  const hasMeals      = plannedDays.length > 0

  return (
    <div className="nutrition-rings-card">
      <div className="nutrition-rings-header">
        <div className="nutrition-rings-title">
          <CalendarDays size={14} />
          This Week, Day by Day
        </div>
        <div className="nutrition-rings-subtitle">
          Planned calories and macros per day — not your logged intake
        </div>
      </div>

      {!hasMeals ? (
        <div className="nutrition-empty">
          Plan your meals above to see nutrition estimates
        </div>
      ) : (
        <>
          <div className="day-rows">
            {dayData.map(({ label, macros }, i) => {
              const pct    = calGoal > 0 ? Math.round((macros.cal / calGoal) * 100) : 0
              const barPct = Math.min(100, pct)
              const color  = barColor(pct)

              return (
                <div key={i} className={`day-row${!macros.hasAny ? ' day-row--empty' : ''}`}>
                  {/* Day label */}
                  <div className="day-row-label">
                    <span className="day-row-name">{label.name}</span>
                    <span className="day-row-date">{label.date}</span>
                  </div>

                  {macros.hasAny ? (
                    <>
                      {/* Calorie bar */}
                      <div className="day-row-bar">
                        <motion.div
                          className="day-row-fill"
                          style={{ background: color }}
                          initial={{ width: '0%' }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut', delay: i * 0.05 }}
                        />
                      </div>

                      {/* Calorie value */}
                      <div className="day-row-cal">
                        {Math.round(macros.cal).toLocaleString()}
                        <span className="day-row-cal-unit"> kcal</span>
                      </div>

                      {/* Macro chips */}
                      <div className="day-row-macros">
                        <span className="day-row-macro">
                          <span className="day-row-macro-label" style={{ color: 'var(--teal-600)' }}>P</span>
                          &nbsp;{Math.round(macros.p)}g
                        </span>
                        <span className="day-row-macro-sep">·</span>
                        <span className="day-row-macro">
                          <span className="day-row-macro-label" style={{ color: 'var(--amber-600)' }}>C</span>
                          &nbsp;{Math.round(macros.c)}g
                        </span>
                        <span className="day-row-macro-sep">·</span>
                        <span className="day-row-macro">
                          <span className="day-row-macro-label" style={{ color: 'var(--blue-500, #3b82f6)' }}>F</span>
                          &nbsp;{Math.round(macros.f)}g
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="day-row-no-meals">No meals planned</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Summary row */}
          <div className="day-avg-row">
            <span>
              Avg <span className="day-avg-value">{avgCal.toLocaleString()} kcal</span> / day
              {' '}· based on{' '}
              <span className="day-avg-value">{plannedDays.length}</span> of 7 days planned
            </span>
            <span className="day-avg-goal">Goal: {calGoal.toLocaleString()} kcal</span>
          </div>
        </>
      )}
    </div>
  )
}
