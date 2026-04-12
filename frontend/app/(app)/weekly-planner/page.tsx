'use client'

import './planner.css'
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import React from 'react'
import {
  ChevronLeft, ChevronRight, Sparkles, Plus, X,
  Search, Flame, Loader2, Check, AlertTriangle, Calendar, Pencil,
} from 'lucide-react'
import { mealPlanApi, MealPlanItem, MealType, WeekView } from '@/services/meal-plan.service'
import { recipeApi, Recipe } from '@/services/recipe.service'
import { useRouter } from 'next/navigation'
import { NutritionProgressRings } from './NutritionProgressRings'
import { TodaysKitchen } from './TodaysKitchen'

// ── Helpers ───────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MEAL_SLOTS: { key: MealType; label: string; icon: string }[] = [
  { key: 'BREAKFAST', label: 'Breakfast', icon: '🌅' },
  { key: 'LUNCH',     label: 'Lunch',     icon: '☀️' },
  { key: 'DINNER',    label: 'Dinner',    icon: '🌙' },
  { key: 'SNACK',     label: 'Snack',     icon: '🍎' },
]

/** Returns the Monday of the week containing `date` — uses UTC to match the backend */
function getMondayOf(date: Date): Date {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  const day = d.getUTCDay() // 0 = Sunday
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + n)
  return d
}

function toISO(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatRange(monday: Date): string {
  const sunday = addDays(monday, 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'UTC' }
  return `${monday.toLocaleDateString('en-GB', opts)} – ${sunday.toLocaleDateString('en-GB', { ...opts, year: 'numeric' })}`
}

// ── Add-meal modal ────────────────────────────────────────

type AddModalMode = 'recipe' | 'custom'

function AddMealModal({
  dayDate,
  mealType,
  mealLabel,
  onClose,
  onConfirm,
}: {
  dayDate: string
  mealType: MealType
  mealLabel: string
  onClose: () => void
  onConfirm: (data: { recipeId?: string; customMealName?: string; notes?: string }) => void
}) {
  const [mode, setMode] = useState<AddModalMode>('recipe')
  const [search, setSearch] = useState('')
  const [customName, setCustomName] = useState('')
  const [customNotes, setCustomNotes] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: recipeData, isLoading: recipesLoading } = useQuery({
    queryKey: ['recipes-search', debouncedSearch],
    queryFn: () => recipeApi.getRecipes({ search: debouncedSearch || undefined, limit: 10 }),
  })

  const dayDisplay = new Date(dayDate + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  const canConfirmCustom = customName.trim().length > 0

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="add-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        <div className="modal-header">
          <div>
            <h3>Add {mealLabel}</h3>
            <p>{dayDisplay}</p>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Tab switch */}
          <div className="modal-tabs">
            <button
              className={`modal-tab ${mode === 'recipe' ? 'active' : ''}`}
              onClick={() => setMode('recipe')}
            >
              From recipes
            </button>
            <button
              className={`modal-tab ${mode === 'custom' ? 'active' : ''}`}
              onClick={() => setMode('custom')}
            >
              Custom meal
            </button>
          </div>

          {mode === 'recipe' ? (
            <>
              <div className="modal-search-wrap">
                <Search size={14} />
                <input
                  className="modal-search"
                  placeholder="Search recipes…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="recipe-results">
                {recipesLoading ? (
                  <div className="results-empty">
                    <Loader2 size={18} className="spin-icon" style={{ margin: '0 auto', display: 'block' }} />
                  </div>
                ) : recipeData?.recipes.length === 0 ? (
                  <div className="results-empty">No recipes found. Try a different search.</div>
                ) : (
                  recipeData?.recipes.map((r) => (
                    <button
                      key={r.id}
                      className="recipe-result-item"
                      onClick={() => onConfirm({ recipeId: r.id })}
                    >
                      {r.imageUrl ? (
                        <img src={r.imageUrl} alt={r.title} className="recipe-result-img" />
                      ) : (
                        <div className="recipe-result-emoji">🍽️</div>
                      )}
                      <div className="recipe-result-info">
                        <div className="recipe-result-title">{r.title}</div>
                        <div className="recipe-result-meta">
                          {[
                            r.calories && `${r.calories} kcal`,
                            r.cuisine,
                          ].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="modal-field">
                <label>Meal name *</label>
                <input
                  type="text"
                  placeholder="e.g. Overnight oats, Leftover pasta…"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="modal-field">
                <label>Notes (optional)</label>
                <textarea
                  placeholder="e.g. approx 450 kcal, prep the night before…"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {mode === 'custom' && (
          <div className="modal-footer">
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              className="modal-confirm-btn"
              disabled={!canConfirmCustom}
              onClick={() =>
                onConfirm({
                  customMealName: customName.trim(),
                  notes: customNotes.trim() || undefined,
                })
              }
            >
              <Check size={14} />
              Add meal
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── AI generate modal ─────────────────────────────────────

function AIGenerateModal({
  weekStartDate,
  weekRange,
  hasExistingPlan,
  isGenerating,
  onClose,
  onConfirm,
}: {
  weekStartDate: string
  weekRange: string
  hasExistingPlan: boolean
  isGenerating: boolean
  onClose: () => void
  onConfirm: (preferences?: string) => void
}) {
  const [preferences, setPreferences] = useState('')

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isGenerating && onClose()}>
      <motion.div
        className="ai-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        <div className="ai-modal-header">
          <div className="ai-modal-title">
            <div className="ai-modal-icon"><Sparkles size={16} /></div>
            <h3>AI Meal Planner</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={isGenerating}><X size={18} /></button>
        </div>

        <div className="ai-modal-body">
          <div className="ai-week-display">
            <Calendar size={14} />
            Generating plan for <strong>{weekRange}</strong>
          </div>

          {hasExistingPlan && (
            <div className="ai-warning">
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              This week already has meals planned. AI will add to the existing plan — existing meals won't be removed.
            </div>
          )}

          <div className="modal-field">
            <label>Any preferences or focus? (optional)</label>
            <textarea
              placeholder="e.g. high protein week, Mediterranean theme, keep it under 30 min per meal…"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              autoFocus
              disabled={isGenerating}
            />
          </div>

          {isGenerating && (
            <div className="ai-generating-status">
              <Loader2 size={14} className="ai-spin" />
              Generating your 7-day meal plan… this may take 15–30 seconds
            </div>
          )}
        </div>

        <div className="ai-modal-footer">
          <button className="modal-cancel-btn" onClick={onClose} disabled={isGenerating}>Cancel</button>
          <button
            className="ai-confirm-btn"
            onClick={() => onConfirm(preferences.trim() || undefined)}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={14} className="ai-spin" /> : <Sparkles size={14} />}
            {isGenerating ? 'Generating…' : 'Generate week'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Edit custom meal modal ────────────────────────────────

function EditCustomMealModal({
  item,
  onClose,
  onConfirm,
}: {
  item: MealPlanItem
  onClose: () => void
  onConfirm: (data: { customMealName: string; notes?: string }) => void
}) {
  const [name, setName] = useState(item.customMealName ?? '')
  const [notes, setNotes] = useState(item.notes ?? '')

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="add-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        <div className="modal-header">
          <div>
            <h3>Edit Meal</h3>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label>Meal name *</label>
            <input
              type="text"
              placeholder="e.g. Overnight oats, Leftover pasta…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="modal-field">
            <label>Notes (optional)</label>
            <textarea
              placeholder="e.g. approx 450 kcal, prep the night before…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-confirm-btn"
            disabled={!name.trim()}
            onClick={() => onConfirm({ customMealName: name.trim(), notes: notes.trim() || undefined })}
          >
            <Check size={14} />
            Save changes
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Meal card ─────────────────────────────────────────────

function MealCard({
  item,
  onDelete,
  onEdit,
  onClick,
}: {
  item: MealPlanItem
  onDelete: () => void
  onEdit: () => void
  onClick: () => void
}) {
  const title = item.recipe?.title ?? item.customMealName ?? 'Meal'
  const cals = item.recipe?.calories

  return (
    <div
      className={`meal-card ${item.recipe ? 'has-recipe' : 'is-custom'}`}
      onClick={onClick}
    >
      <div className="meal-card-actions">
        {!item.recipe && (
          <button
            className="meal-card-edit"
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            title="Edit meal"
          >
            <Pencil size={11} />
          </button>
        )}
        <button
          className="meal-card-delete"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Remove meal"
        >
          <X size={11} />
        </button>
      </div>
      <span className={item.recipe ? 'meal-card-tag' : 'meal-card-custom-tag'}>
        {item.recipe ? 'Recipe' : 'Custom'}
      </span>
      <span className="meal-card-title">{title}</span>
      {cals && (
        <span className="meal-card-cals">
          <Flame size={10} />{cals} kcal
        </span>
      )}
      {item.notes && !item.recipe && (
        <span className="meal-card-cals" style={{ fontStyle: 'italic' }}>
          {item.notes.slice(0, 40)}{item.notes.length > 40 ? '…' : ''}
        </span>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────

interface SlotTarget { dayIndex: number; date: string; mealType: MealType; mealLabel: string }

export default function WeeklyPlannerPage() {
  const queryClient = useQueryClient()
  const router = useRouter()

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [addTarget, setAddTarget] = useState<SlotTarget | null>(null)
  const [editTarget, setEditTarget] = useState<MealPlanItem | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null)

  const weekStartISO = toISO(weekStart)
  const todayISO = toISO(new Date())

  const showToast = (msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch week
  const { data: weekView, isLoading } = useQuery<WeekView>({
    queryKey: ['meal-plan-week', weekStartISO],
    queryFn: () => mealPlanApi.getWeekView(weekStartISO),
  })

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['meal-plan-week', weekStartISO] })
    queryClient.invalidateQueries({ queryKey: ['meal-plan-week'] })
  }, [queryClient, weekStartISO])

  // Add meal
  const { mutate: addMeal, isPending: isAdding } = useMutation({
    mutationFn: async ({
      date,
      mealType,
      recipeId,
      customMealName,
      notes,
    }: {
      date: string
      mealType: MealType
      recipeId?: string
      customMealName?: string
      notes?: string
    }) => {
      // Ensure week plan exists first
      let planId = weekView?.mealPlan?.id
      if (!planId) {
        const plan = await mealPlanApi.createMealPlan(weekStartISO)
        planId = plan.id
      }
      return mealPlanApi.addMealItem(planId, { date, mealType, recipeId, customMealName, notes })
    },
    onSuccess: () => {
      setAddTarget(null)
      invalidate()
      showToast('Meal added')
    },
    onError: () => showToast('Failed to add meal', 'error'),
  })

  // Delete meal
  const { mutate: deleteMeal } = useMutation({
    mutationFn: (itemId: string) => mealPlanApi.deleteMealItem(itemId),
    onSuccess: () => { invalidate(); showToast('Meal removed') },
    onError: () => showToast('Failed to remove meal', 'error'),
  })

  // Update custom meal
  const { mutate: updateMeal } = useMutation({
    mutationFn: ({ itemId, data }: { itemId: string; data: { customMealName?: string; notes?: string } }) =>
      mealPlanApi.updateMealItem(itemId, data),
    onSuccess: () => { setEditTarget(null); invalidate(); showToast('Meal updated') },
    onError: () => showToast('Failed to update meal', 'error'),
  })

  // AI generate
  const { mutate: generateAI, isPending: isGenerating } = useMutation({
    mutationFn: (preferences?: string) =>
      mealPlanApi.generateAIMealPlan(weekStartISO, preferences),
    onSuccess: () => {
      setShowAI(false)
      invalidate()
      showToast('AI meal plan generated!')
    },
    onError: () => {
      setShowAI(false)
      showToast('Failed to generate plan', 'error')
    },
  })

  const prevWeek = () => setWeekStart((d) => addDays(d, -7))
  const nextWeek = () => setWeekStart((d) => addDays(d, 7))
  const goToday  = () => setWeekStart(getMondayOf(new Date()))

  const weekDates = Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)))
  const weekRange = formatRange(weekStart)

  return (
    <div className="planner-root">
      {/* ── Top bar ── */}
      <motion.div
        className="planner-topbar"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="planner-title-group">
          <h1>Weekly Planner</h1>
          <p>Plan your meals for the week — or let AI do it.</p>
        </div>

        <div className="planner-actions">
          {/* Week navigation */}
          <div className="week-nav">
            <button className="week-nav-btn" onClick={prevWeek} title="Previous week">
              <ChevronLeft size={16} />
            </button>
            <span className="week-range">{weekRange}</span>
            <button className="week-nav-btn" onClick={nextWeek} title="Next week">
              <ChevronRight size={16} />
            </button>
          </div>

          <button className="today-btn" onClick={goToday}>Today</button>

          <button
            className="ai-generate-btn"
            onClick={() => setShowAI(true)}
            disabled={isGenerating}
          >
            {isGenerating
              ? <Loader2 size={15} className="spin-icon" />
              : <Sparkles size={15} />}
            {isGenerating ? 'Generating…' : 'AI Generate'}
          </button>
        </div>
      </motion.div>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="planner-loading">
          <Loader2 size={28} className="spin-icon" />
        </div>
      ) : (
        <motion.div
          className="planner-grid-wrap"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <div className="planner-grid">
            {/* Corner */}
            <div className="grid-corner" />

            {/* Day headers */}
            {weekDates.map((date, i) => {
              const isToday = date === todayISO
              const dayNum = addDays(weekStart, i).getUTCDate()
              return (
                <div key={date} className={`day-header ${isToday ? 'today' : ''}`}>
                  <div className="day-name">{DAY_NAMES[i]}</div>
                  <div className="day-date">{dayNum}</div>
                </div>
              )
            })}

            {/* Meal rows */}
            {MEAL_SLOTS.map((slot) => (
              <React.Fragment key={slot.key}>
                {/* Row label */}
                <div className="meal-row-label">
                  <span className="meal-row-icon">{slot.icon}</span>
                  <span className="meal-row-name">{slot.label}</span>
                </div>

                {/* 7 cells */}
                {weekDates.map((date, dayIdx) => {
                  const dayData = weekView?.days[dayIdx]
                  const item = dayData?.[slot.key.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack'] ?? null

                  return (
                    <div key={`${date}-${slot.key}`} className="meal-cell">
                      {item ? (
                        <MealCard
                          item={item}
                          onDelete={() => deleteMeal(item.id)}
                          onEdit={() => setEditTarget(item)}
                          onClick={() => item.recipe && router.push(`/recipes/${item.recipe.id}`)}
                        />
                      ) : (
                        <div className="meal-cell-empty">
                          <button
                            className="add-meal-btn"
                            title={`Add ${slot.label}`}
                            onClick={() =>
                              setAddTarget({
                                dayIndex: dayIdx,
                                date,
                                mealType: slot.key,
                                mealLabel: slot.label,
                              })
                            }
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </React.Fragment>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── Bottom grid: Nutrition rings + Today's Kitchen ── */}
      <div className="planner-bottom-grid">
        <NutritionProgressRings weekView={weekView} />
        <TodaysKitchen weekView={weekView} />
      </div>

      {/* ── Add meal modal ── */}
      <AnimatePresence>
        {addTarget && (
          <AddMealModal
            dayDate={addTarget.date}
            mealType={addTarget.mealType}
            mealLabel={addTarget.mealLabel}
            onClose={() => setAddTarget(null)}
            onConfirm={({ recipeId, customMealName, notes }) =>
              addMeal({
                date: addTarget.date,
                mealType: addTarget.mealType,
                recipeId,
                customMealName,
                notes,
              })
            }
          />
        )}
      </AnimatePresence>

      {/* ── Edit custom meal modal ── */}
      <AnimatePresence>
        {editTarget && (
          <EditCustomMealModal
            item={editTarget}
            onClose={() => setEditTarget(null)}
            onConfirm={(data) => updateMeal({ itemId: editTarget.id, data })}
          />
        )}
      </AnimatePresence>

      {/* ── AI generate modal ── */}
      <AnimatePresence>
        {showAI && (
          <AIGenerateModal
            weekStartDate={weekStartISO}
            weekRange={weekRange}
            hasExistingPlan={!!weekView?.mealPlan}
            isGenerating={isGenerating}
            onClose={() => !isGenerating && setShowAI(false)}
            onConfirm={(prefs) => generateAI(prefs)}
          />
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`toast ${toast.type === 'error' ? 'error' : ''}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            {toast.type === 'ok' ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
