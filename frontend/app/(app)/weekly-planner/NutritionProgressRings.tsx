'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
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

// ── Constants ─────────────────────────────────────────────

const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const CHART_HEIGHT = 160 // px — max bar height
const DAY_LABEL_H  = 44  // px — day name + date + dot below the bar

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
  const d = new Date(dateStr + 'T12:00:00')
  return {
    name: DAY_NAMES[d.getDay()],
    date: `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`,
  }
}

function barGradient(pct: number): string {
  if (pct > 110) return 'linear-gradient(180deg, var(--coral-300, #fca5a5) 0%, var(--coral-400) 100%)'
  if (pct >= 85)  return 'linear-gradient(180deg, var(--teal-300, #5eead4) 0%, var(--teal-500, #14b8a6) 100%)'
  return 'linear-gradient(180deg, var(--amber-300, #fcd34d) 0%, var(--amber-500, #f59e0b) 100%)'
}

// ── NutritionProgressRings ────────────────────────────────

export function NutritionProgressRings({ weekView }: NutritionProgressRingsProps) {
  const { data: profile } = useQuery<UserProfile>({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
  })

  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const calGoal = profile?.calorieGoal ?? 2000
  const days    = weekView?.days ?? []

  const dayData = days.map((day) => ({
    label:  formatDayLabel(day.date),
    macros: getDayMacros(day),
    date:   day.date,
  }))

  const plannedDays = dayData.filter((d) => d.macros.hasAny)
  const totalCal    = plannedDays.reduce((sum, d) => sum + d.macros.cal, 0)
  const avgCal      = plannedDays.length > 0 ? Math.round(totalCal / plannedDays.length) : 0
  const hasMeals    = plannedDays.length > 0

  // Scale so the tallest bar never overflows — always at least 130% of goal
  const maxCal       = Math.max(calGoal * 1.3, ...dayData.map((d) => d.macros.cal))
  const goalLinePct  = calGoal / maxCal
  const goalLineBottom = DAY_LABEL_H + CHART_HEIGHT * goalLinePct

  const todayISO = new Date().toISOString().split('T')[0]
  const selected = selectedIdx !== null ? dayData[selectedIdx] : null

  return (
    <div className="nutrition-rings-card">
      <div className="nutrition-rings-header">
        <div className="nutrition-rings-title">
          <CalendarDays size={14} />
          Week at a Glance
        </div>
        <div className="nutrition-rings-subtitle">
          Planned calories vs goal — not your logged intake
        </div>
      </div>

      {!hasMeals ? (
        <div className="nutrition-empty">
          Plan your meals above to see nutrition estimates
        </div>
      ) : (
        <>
          {/* ── Bar chart ── */}
          <div className="wag-chart">

            {/* Dashed goal line */}
            <div className="wag-goal-line" style={{ bottom: goalLineBottom }}>
              <span className="wag-goal-label">Goal {calGoal.toLocaleString()}</span>
            </div>

            <div className="wag-columns">
              {dayData.map(({ label, macros, date }, i) => {
                const pct        = calGoal > 0 ? (macros.cal / calGoal) * 100 : 0
                const barH       = macros.hasAny
                  ? Math.max(6, Math.round(CHART_HEIGHT * (macros.cal / maxCal)))
                  : 0
                const isToday    = date === todayISO
                const isSelected = selectedIdx === i

                return (
                  <button
                    key={i}
                    className={[
                      'wag-col',
                      isSelected        ? 'wag-col--selected' : '',
                      !macros.hasAny    ? 'wag-col--empty'    : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => macros.hasAny && setSelectedIdx(isSelected ? null : i)}
                    type="button"
                    title={macros.hasAny ? `${label.name} — ${Math.round(macros.cal).toLocaleString()} kcal` : label.name}
                  >
                    {/* Calorie label above bar */}
                    <span className="wag-bar-cal">
                      {macros.hasAny ? Math.round(macros.cal).toLocaleString() : ''}
                    </span>

                    {/* Bar track — fixed height so all columns align */}
                    <div className="wag-bar-track">
                      {macros.hasAny ? (
                        <motion.div
                          className="wag-bar"
                          style={{ background: barGradient(pct) }}
                          initial={{ height: 0 }}
                          animate={{ height: barH }}
                          transition={{ duration: 0.5, ease: 'easeOut', delay: i * 0.05 }}
                        />
                      ) : (
                        <div className="wag-bar-stub" />
                      )}
                    </div>

                    {/* Day label */}
                    <div className={`wag-day-label${isToday ? ' wag-day-label--today' : ''}`}>
                      <span className="wag-day-name">{label.name}</span>
                      <span className="wag-day-date">{label.date}</span>
                      {isToday && <span className="wag-today-dot" />}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Detail strip (shown when a bar is clicked) ── */}
          <AnimatePresence>
            {selected?.macros.hasAny && (
              <motion.div
                className="wag-detail"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                <div className="wag-detail-day">
                  {selected.label.name} · {selected.label.date}
                </div>
                <div className="wag-detail-macros">
                  <div className="wag-detail-macro">
                    <span className="wag-detail-val" style={{ color: 'var(--coral-400)' }}>
                      {Math.round(selected.macros.cal).toLocaleString()}
                    </span>
                    <span className="wag-detail-label">kcal</span>
                  </div>
                  <div className="wag-detail-macro">
                    <span className="wag-detail-val" style={{ color: 'var(--teal-500, #14b8a6)' }}>
                      {Math.round(selected.macros.p)}g
                    </span>
                    <span className="wag-detail-label">protein</span>
                  </div>
                  <div className="wag-detail-macro">
                    <span className="wag-detail-val" style={{ color: 'var(--amber-500, #f59e0b)' }}>
                      {Math.round(selected.macros.c)}g
                    </span>
                    <span className="wag-detail-label">carbs</span>
                  </div>
                  <div className="wag-detail-macro">
                    <span className="wag-detail-val" style={{ color: 'var(--blue-500, #3b82f6)' }}>
                      {Math.round(selected.macros.f)}g
                    </span>
                    <span className="wag-detail-label">fat</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Summary footer ── */}
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
