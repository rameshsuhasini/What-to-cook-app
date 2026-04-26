'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CalendarPlus, Loader2, Check } from 'lucide-react'
import { mealPlanApi, MealType } from '@/services/meal-plan.service'

const MEAL_TYPES: { value: MealType; label: string; emoji: string }[] = [
  { value: 'BREAKFAST', label: 'Breakfast', emoji: '🌅' },
  { value: 'LUNCH',     label: 'Lunch',     emoji: '☀️' },
  { value: 'DINNER',    label: 'Dinner',    emoji: '🌙' },
  { value: 'SNACK',     label: 'Snack',     emoji: '🍎' },
]

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatDayChip(dateStr: string, idx: number) {
  const d = new Date(dateStr)
  const day = DAY_LABELS[idx] ?? DAY_LABELS[d.getDay() === 0 ? 6 : d.getDay() - 1]
  return { day, date: d.getDate() }
}

interface Props {
  recipeId: string
  recipeTitle: string
  onClose: () => void
}

export default function AddToPlanModal({ recipeId, recipeTitle, onClose }: Props) {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedMealType, setSelectedMealType] = useState<MealType | null>(null)
  const [done, setDone] = useState(false)

  const { data: weekView, isLoading: weekLoading } = useQuery({
    queryKey: ['week-view-modal'],
    queryFn: () => mealPlanApi.getWeekView(),
    staleTime: 2 * 60 * 1000,
  })

  const { mutate: addToPlan, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedMealType) return

      let mealPlan = weekView?.mealPlan
      if (!mealPlan) {
        // No plan for this week — create one first
        const weekStart = weekView?.weekStartDate
        if (!weekStart) throw new Error('No week start date')
        mealPlan = await mealPlanApi.createMealPlan(weekStart)
      }

      await mealPlanApi.addMealItem(mealPlan.id, {
        date: selectedDate,
        mealType: selectedMealType,
        recipeId,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['week-view'] })
      queryClient.invalidateQueries({ queryKey: ['week-view-modal'] })
      setDone(true)
      setTimeout(onClose, 1400)
    },
  })

  const canSubmit = !!selectedDate && !!selectedMealType && !isPending && !done

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="atp-modal"
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 14 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="atp-header">
          <div className="atp-title">
            <div className="atp-icon"><CalendarPlus size={15} /></div>
            <div>
              <h2>Add to Meal Plan</h2>
              <p className="atp-subtitle" title={recipeTitle}>
                {recipeTitle.length > 38 ? recipeTitle.slice(0, 38) + '…' : recipeTitle}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="atp-body">
          {weekLoading ? (
            <div className="atp-loading"><Loader2 size={22} className="spin-icon" /></div>
          ) : done ? (
            <motion.div
              className="atp-success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="atp-success-icon"><Check size={22} /></div>
              <p>Added to your meal plan!</p>
            </motion.div>
          ) : (
            <>
              {/* Day picker */}
              <div className="atp-section-label">Pick a day</div>
              <div className="atp-day-chips">
                {weekView?.days.map((day, i) => {
                  const { day: dayLabel, date } = formatDayChip(day.date, i)
                  const active = selectedDate === day.date
                  return (
                    <button
                      key={day.date}
                      className={`atp-day-chip ${active ? 'atp-day-chip--active' : ''}`}
                      onClick={() => setSelectedDate(day.date)}
                    >
                      <span className="atp-day-name">{dayLabel}</span>
                      <span className="atp-day-num">{date}</span>
                    </button>
                  )
                })}
              </div>

              {/* Meal type picker */}
              <div className="atp-section-label" style={{ marginTop: '1.1rem' }}>Meal type</div>
              <div className="atp-meal-chips">
                {MEAL_TYPES.map((m) => (
                  <button
                    key={m.value}
                    className={`atp-meal-chip ${selectedMealType === m.value ? 'atp-meal-chip--active' : ''}`}
                    onClick={() => setSelectedMealType(m.value)}
                  >
                    <span>{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!done && !weekLoading && (
          <div className="modal-footer">
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              className="atp-confirm-btn"
              onClick={() => addToPlan()}
              disabled={!canSubmit}
            >
              {isPending ? <Loader2 size={14} className="spin-icon" /> : <CalendarPlus size={14} />}
              Add to Plan
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
