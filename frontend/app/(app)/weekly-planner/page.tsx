'use client'

import './planner.css'
import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import React from 'react'
import {
  ChevronLeft, ChevronRight, Sparkles, Plus, X,
  Search, Flame, Loader2, Check, AlertTriangle, Calendar, Pencil,
  ArrowLeft, Trash2, ChevronDown, ChevronUp, Clock, Users,
} from 'lucide-react'
import { mealPlanApi, MealPlanItem, MealType, WeekView } from '@/services/meal-plan.service'
import { recipeApi, Recipe } from '@/services/recipe.service'
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
type CustomPhase = 'input' | 'generating' | 'preview'

interface EditableIngredient {
  ingredientName: string
  quantity: number | ''
  unit: string
}

interface EditableRecipe {
  id: string
  title: string
  description: string
  calories: number | ''
  protein: number | ''
  carbs: number | ''
  fat: number | ''
  prepTimeMinutes: number | ''
  cookTimeMinutes: number | ''
  servings: number | ''
  cuisine: string
  ingredients: EditableIngredient[]
  steps: { stepNumber: number; instructionText: string }[]
}

function toEditable(r: Recipe): EditableRecipe {
  return {
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    calories: r.calories ?? '',
    protein: r.protein ?? '',
    carbs: r.carbs ?? '',
    fat: r.fat ?? '',
    prepTimeMinutes: r.prepTimeMinutes ?? '',
    cookTimeMinutes: r.cookTimeMinutes ?? '',
    servings: r.servings ?? '',
    cuisine: r.cuisine ?? '',
    ingredients: r.ingredients.map((i) => ({
      ingredientName: i.ingredientName,
      quantity: i.quantity ?? '',
      unit: i.unit ?? '',
    })),
    steps: r.steps.map((s) => ({
      stepNumber: s.stepNumber,
      instructionText: s.instructionText,
    })),
  }
}

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
  const [customPhase, setCustomPhase] = useState<CustomPhase>('input')
  const [editableRecipe, setEditableRecipe] = useState<EditableRecipe | null>(null)
  const [genError, setGenError] = useState('')
  const [saving, setSaving] = useState(false)
  const [stepsOpen, setStepsOpen] = useState(false)

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

  // ── Generate recipe from meal name ──────────────────────
  const handleGenerate = async () => {
    if (!customName.trim()) return
    setGenError('')
    setCustomPhase('generating')
    try {
      const recipe = await recipeApi.generateRecipe({ prompt: customName.trim() })
      setEditableRecipe(toEditable(recipe))
      setCustomPhase('preview')
    } catch {
      setGenError('Failed to generate recipe. Please try again.')
      setCustomPhase('input')
    }
  }

  // ── Ingredient helpers ───────────────────────────────────
  const updateIngredient = (idx: number, field: keyof EditableIngredient, val: string | number | '') =>
    setEditableRecipe((r) =>
      r ? { ...r, ingredients: r.ingredients.map((ing, i) => (i === idx ? { ...ing, [field]: val } : ing)) } : r
    )

  const removeIngredient = (idx: number) =>
    setEditableRecipe((r) => r ? { ...r, ingredients: r.ingredients.filter((_, i) => i !== idx) } : r)

  const addIngredient = () =>
    setEditableRecipe((r) =>
      r ? { ...r, ingredients: [...r.ingredients, { ingredientName: '', quantity: '', unit: '' }] } : r
    )

  // ── Save edited recipe and add to planner ────────────────
  const handleSaveAndAdd = async () => {
    if (!editableRecipe) return
    setSaving(true)
    setGenError('')
    try {
      await recipeApi.updateRecipe(editableRecipe.id, {
        title:           editableRecipe.title.trim(),
        description:     editableRecipe.description.trim() || undefined,
        calories:        editableRecipe.calories        === '' ? undefined : Number(editableRecipe.calories),
        protein:         editableRecipe.protein         === '' ? undefined : Number(editableRecipe.protein),
        carbs:           editableRecipe.carbs           === '' ? undefined : Number(editableRecipe.carbs),
        fat:             editableRecipe.fat             === '' ? undefined : Number(editableRecipe.fat),
        prepTimeMinutes: editableRecipe.prepTimeMinutes === '' ? undefined : Number(editableRecipe.prepTimeMinutes),
        cookTimeMinutes: editableRecipe.cookTimeMinutes === '' ? undefined : Number(editableRecipe.cookTimeMinutes),
        servings:        editableRecipe.servings        === '' ? undefined : Number(editableRecipe.servings),
        cuisine:         editableRecipe.cuisine.trim()  || undefined,
        ingredients: editableRecipe.ingredients
          .filter((i) => i.ingredientName.trim())
          .map((i) => ({
            ingredientName: i.ingredientName.trim(),
            quantity:       i.quantity === '' ? undefined : Number(i.quantity),
            unit:           i.unit.trim() || undefined,
          })),
      })
      onConfirm({ recipeId: editableRecipe.id })
    } catch {
      setGenError('Failed to save recipe. Please try again.')
      setSaving(false)
    }
  }

  const isPreview = customPhase === 'preview'

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <motion.div
        className={`add-modal${isPreview ? ' add-modal--wide' : ''}`}
        layout
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* ── Header ── */}
        <div className="modal-header">
          <div>
            <h3>{isPreview ? 'Review & Edit Recipe' : `Add ${mealLabel}`}</h3>
            <p>{isPreview ? (editableRecipe?.title ?? '') : dayDisplay}</p>
          </div>
          <button className="modal-close" onClick={onClose} disabled={saving}>
            <X size={18} />
          </button>
        </div>

        {/* ── Body — non-preview modes ── */}
        {!isPreview && (
          <div className="modal-body">
            {/* Tab switch */}
            <div className="modal-tabs">
              <button
                className={`modal-tab ${mode === 'recipe' ? 'active' : ''}`}
                onClick={() => { setMode('recipe'); setCustomPhase('input') }}
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

            {/* Recipe search tab */}
            {mode === 'recipe' && (
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
                          <img src={r.imageUrl} alt={r.title} className="recipe-result-img" loading="lazy" decoding="async" />
                        ) : (
                          <div className="recipe-result-emoji">🍽️</div>
                        )}
                        <div className="recipe-result-info">
                          <div className="recipe-result-title">{r.title}</div>
                          <div className="recipe-result-meta">
                            {[r.calories && `${r.calories} kcal`, r.cuisine].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}

            {/* Custom meal tab — generating spinner */}
            {mode === 'custom' && customPhase === 'generating' && (
              <div className="custom-generating">
                <Loader2 size={24} className="custom-generating-spin" />
                <p>Generating recipe for <strong>"{customName}"</strong></p>
                <span>This takes about 10 seconds…</span>
              </div>
            )}

            {/* Custom meal tab — input form */}
            {mode === 'custom' && customPhase === 'input' && (
              <>
                <div className="modal-field">
                  <label>Meal name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Butter Chicken, Overnight Oats…"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && customName.trim() && handleGenerate()}
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
                {genError && <p className="custom-gen-error">{genError}</p>}
                {/* Generate button */}
                <button
                  className="generate-recipe-btn"
                  disabled={!customName.trim()}
                  onClick={handleGenerate}
                >
                  <Sparkles size={14} />
                  Generate Recipe with AI
                </button>
              </>
            )}
          </div>
        )}

        {/* ── Body — preview / edit recipe ── */}
        {isPreview && editableRecipe && (
          <div className="modal-body recipe-preview-body">

            {/* Title */}
            <div className="preview-field">
              <label>Recipe title</label>
              <input
                type="text"
                value={editableRecipe.title}
                onChange={(e) => setEditableRecipe((r) => r ? { ...r, title: e.target.value } : r)}
              />
            </div>

            {/* Description */}
            <div className="preview-field">
              <label>Description</label>
              <textarea
                value={editableRecipe.description}
                onChange={(e) => setEditableRecipe((r) => r ? { ...r, description: e.target.value } : r)}
              />
            </div>

            {/* Time + Servings row */}
            <div className="preview-field-row">
              <div className="preview-field">
                <label><Clock size={11} /> Prep (min)</label>
                <input
                  type="number" min={0}
                  value={editableRecipe.prepTimeMinutes}
                  onChange={(e) => setEditableRecipe((r) => r ? { ...r, prepTimeMinutes: e.target.value === '' ? '' : Number(e.target.value) } : r)}
                />
              </div>
              <div className="preview-field">
                <label><Clock size={11} /> Cook (min)</label>
                <input
                  type="number" min={0}
                  value={editableRecipe.cookTimeMinutes}
                  onChange={(e) => setEditableRecipe((r) => r ? { ...r, cookTimeMinutes: e.target.value === '' ? '' : Number(e.target.value) } : r)}
                />
              </div>
              <div className="preview-field">
                <label><Users size={11} /> Servings</label>
                <input
                  type="number" min={1}
                  value={editableRecipe.servings}
                  onChange={(e) => setEditableRecipe((r) => r ? { ...r, servings: e.target.value === '' ? '' : Number(e.target.value) } : r)}
                />
              </div>
            </div>

            {/* Macros */}
            <div className="preview-macros">
              {(
                [
                  { key: 'calories', label: 'Calories', unit: 'kcal', color: 'coral' },
                  { key: 'protein',  label: 'Protein',  unit: 'g',    color: 'teal'  },
                  { key: 'carbs',    label: 'Carbs',    unit: 'g',    color: 'amber' },
                  { key: 'fat',      label: 'Fat',      unit: 'g',    color: 'blue'  },
                ] as const
              ).map(({ key, label, unit, color }) => (
                <div key={key} className={`preview-macro-field preview-macro-field--${color}`}>
                  <label>{label}</label>
                  <div className="preview-macro-input-wrap">
                    <input
                      type="number" min={0}
                      value={editableRecipe[key]}
                      onChange={(e) =>
                        setEditableRecipe((r) =>
                          r ? { ...r, [key]: e.target.value === '' ? '' : Number(e.target.value) } : r
                        )
                      }
                    />
                    <span>{unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ingredients */}
            <div className="preview-section">
              <div className="preview-section-title">Ingredients</div>
              <div className="preview-ingredients">
                {editableRecipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="ingredient-row">
                    <input
                      className="ingredient-row-name"
                      type="text"
                      placeholder="Ingredient"
                      value={ing.ingredientName}
                      onChange={(e) => updateIngredient(idx, 'ingredientName', e.target.value)}
                    />
                    <input
                      className="ingredient-row-qty"
                      type="number"
                      placeholder="Qty"
                      min={0}
                      value={ing.quantity}
                      onChange={(e) =>
                        updateIngredient(idx, 'quantity', e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                    <input
                      className="ingredient-row-unit"
                      type="text"
                      placeholder="Unit"
                      value={ing.unit}
                      onChange={(e) => updateIngredient(idx, 'unit', e.target.value)}
                    />
                    <button
                      className="ingredient-row-del"
                      onClick={() => removeIngredient(idx)}
                      title="Remove ingredient"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button className="add-ingredient-btn" onClick={addIngredient}>
                  <Plus size={13} /> Add ingredient
                </button>
              </div>
            </div>

            {/* Steps — collapsible */}
            <div className="preview-section">
              <button
                className="preview-steps-toggle"
                onClick={() => setStepsOpen((v) => !v)}
              >
                <span>Steps ({editableRecipe.steps.length})</span>
                {stepsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {stepsOpen && (
                <ol className="preview-steps-list">
                  {editableRecipe.steps.map((s) => (
                    <li key={s.stepNumber} className="preview-step-item">
                      {s.instructionText}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {genError && <p className="custom-gen-error">{genError}</p>}
          </div>
        )}

        {/* ── Footer ── */}
        {!isPreview && mode === 'custom' && customPhase === 'input' && (
          <div className="modal-footer">
            <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
            <button
              className="modal-confirm-btn modal-confirm-btn--ghost"
              disabled={!customName.trim()}
              onClick={() =>
                onConfirm({
                  customMealName: customName.trim(),
                  notes: customNotes.trim() || undefined,
                })
              }
            >
              <Check size={14} />
              Add as custom
            </button>
          </div>
        )}

        {isPreview && (
          <div className="modal-footer">
            <button
              className="modal-cancel-btn"
              onClick={() => setCustomPhase('input')}
              disabled={saving}
            >
              <ArrowLeft size={14} style={{ marginRight: 4 }} />
              Back
            </button>
            <button
              className="modal-confirm-btn"
              onClick={handleSaveAndAdd}
              disabled={saving || !editableRecipe?.title.trim()}
            >
              {saving ? <Loader2 size={14} className="spin-icon" /> : <Check size={14} />}
              {saving ? 'Saving…' : 'Save & Add to Planner'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── AI generate modal ─────────────────────────────────────

const AI_PRESETS = [
  { label: 'Today',    days: 1 },
  { label: '2 days',  days: 2 },
  { label: '3 days',  days: 3 },
  { label: 'Full week', days: 7 },
]

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
  onConfirm: (preferences?: string, targetDates?: string[], usePantry?: boolean) => void
}) {
  const [preferences, setPreferences] = useState('')
  const [usePantry, setUsePantry] = useState(true)

  // Build the 7 ISO dates for the displayed week
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStartDate)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  })

  // Default selection: full week
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(weekDates))
  const [activePreset, setActivePreset] = useState<number>(7)

  const todayISO = new Date().toISOString().split('T')[0]

  const applyPreset = (days: number) => {
    setActivePreset(days)
    // Start from today if today is in this week, otherwise from Monday
    const startFrom = weekDates.includes(todayISO) ? todayISO : weekDates[0]
    const startIdx = weekDates.indexOf(startFrom)
    const slice = new Set(weekDates.slice(startIdx, startIdx + days))
    setSelectedDates(slice)
  }

  const toggleDate = (date: string) => {
    setActivePreset(-1) // custom selection — clear preset highlight
    setSelectedDates(prev => {
      const next = new Set(prev)
      if (next.has(date)) {
        if (next.size === 1) return prev // keep at least 1
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  const selectedCount = selectedDates.size

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isGenerating && onClose()}>
      <motion.div
        className="ai-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="ai-modal-header">
          <div className="ai-modal-title">
            <div className="ai-modal-icon"><Sparkles size={16} /></div>
            <h3>AI Meal Planner</h3>
          </div>
          <button className="modal-close" onClick={onClose} disabled={isGenerating}><X size={18} /></button>
        </div>

        <div className="ai-modal-body">
          {/* Week context */}
          <div className="ai-week-display">
            <Calendar size={14} />
            Week of <strong>{weekRange}</strong>
          </div>

          {/* Preset chips */}
          <div className="ai-section">
            <span className="ai-section-label">Quick select</span>
            <div className="ai-presets">
              {AI_PRESETS.map(p => (
                <button
                  key={p.days}
                  className={`ai-preset-chip ${activePreset === p.days ? 'ai-preset-chip--active' : ''}`}
                  onClick={() => applyPreset(p.days)}
                  disabled={isGenerating}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Day grid */}
          <div className="ai-section">
            <span className="ai-section-label">
              Adjust days
              <span className="ai-section-count">{selectedCount} selected</span>
            </span>
            <div className="ai-day-grid">
              {weekDates.map((date, i) => {
                const isToday = date === todayISO
                const d = new Date(date + 'T12:00:00')
                const dayNum = d.getUTCDate()
                const selected = selectedDates.has(date)
                return (
                  <button
                    key={date}
                    className={`ai-day-btn ${selected ? 'ai-day-btn--selected' : ''} ${isToday ? 'ai-day-btn--today' : ''}`}
                    onClick={() => toggleDate(date)}
                    disabled={isGenerating}
                  >
                    <span className="ai-day-name">{DAY_NAMES[i]}</span>
                    <span className="ai-day-num">{dayNum}</span>
                    {isToday && <span className="ai-day-today-dot" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Pantry toggle */}
          <div className="ai-pantry-row">
            <div className="ai-pantry-text">
              <span className="ai-pantry-label">Use pantry ingredients</span>
              <span className="ai-pantry-sub">AI will plan meals around what you already have at home</span>
            </div>
            <label className="ai-toggle">
              <input
                type="checkbox"
                checked={usePantry}
                onChange={(e) => setUsePantry(e.target.checked)}
                disabled={isGenerating}
              />
              <span className="ai-toggle-slider" />
            </label>
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
              disabled={isGenerating}
            />
          </div>

          {isGenerating && (
            <div className="ai-generating-status">
              <Loader2 size={14} className="ai-spin" />
              Planning your {selectedCount}-day menu… this takes about 15 seconds
            </div>
          )}
        </div>

        <div className="ai-modal-footer">
          <button className="modal-cancel-btn" onClick={onClose} disabled={isGenerating}>Cancel</button>
          <button
            className="ai-confirm-btn"
            onClick={() => onConfirm(preferences.trim() || undefined, Array.from(selectedDates), usePantry)}
            disabled={isGenerating}
          >
            {isGenerating ? <Loader2 size={14} className="ai-spin" /> : <Sparkles size={14} />}
            {isGenerating ? 'Planning…' : `Generate ${selectedCount} day${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Recipe detail modal ───────────────────────────────────

function RecipeDetailModal({
  recipeId,
  onClose,
}: {
  recipeId: string
  onClose: () => void
}) {
  const { data: recipe, isLoading } = useQuery({
    queryKey: ['recipe-detail', recipeId],
    queryFn: () => recipeApi.getRecipeById(recipeId),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="recipe-detail-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3>{isLoading ? 'Loading recipe…' : (recipe?.title ?? 'Recipe')}</h3>
            {!isLoading && recipe?.cuisine && <p>{recipe.cuisine}</p>}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="recipe-detail-loading">
            <Loader2 size={24} className="spin-icon" />
          </div>
        ) : recipe ? (
          <div className="recipe-detail-body">
            {recipe.description && (
              <p className="recipe-detail-desc">{recipe.description}</p>
            )}

            {/* Meta chips */}
            <div className="recipe-detail-meta">
              {recipe.prepTimeMinutes != null && (
                <span><Clock size={12} /> Prep {recipe.prepTimeMinutes}m</span>
              )}
              {recipe.cookTimeMinutes != null && (
                <span><Flame size={12} /> Cook {recipe.cookTimeMinutes}m</span>
              )}
              {recipe.servings != null && (
                <span><Users size={12} /> Serves {recipe.servings}</span>
              )}
            </div>

            {/* Macro pills */}
            {(recipe.calories || recipe.protein || recipe.carbs || recipe.fat) && (
              <div className="recipe-detail-macros">
                {recipe.calories != null && (
                  <div className="rdm-pill rdm-pill--coral">
                    <span>{recipe.calories}</span><small>kcal</small>
                  </div>
                )}
                {recipe.protein != null && (
                  <div className="rdm-pill rdm-pill--teal">
                    <span>{recipe.protein}g</span><small>protein</small>
                  </div>
                )}
                {recipe.carbs != null && (
                  <div className="rdm-pill rdm-pill--amber">
                    <span>{recipe.carbs}g</span><small>carbs</small>
                  </div>
                )}
                {recipe.fat != null && (
                  <div className="rdm-pill rdm-pill--blue">
                    <span>{recipe.fat}g</span><small>fat</small>
                  </div>
                )}
              </div>
            )}

            {/* Ingredients */}
            {recipe.ingredients.length > 0 && (
              <div className="recipe-detail-section">
                <div className="recipe-detail-section-title">Ingredients</div>
                <ul className="recipe-detail-ings">
                  {recipe.ingredients.map((ing) => (
                    <li key={ing.id}>
                      <span className="rdi-dot" />
                      <span className="rdi-name">{ing.ingredientName}</span>
                      {(ing.quantity != null || ing.unit) && (
                        <span className="rdi-qty">
                          {[ing.quantity, ing.unit].filter(Boolean).join(' ')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Steps */}
            {recipe.steps.length > 0 && (
              <div className="recipe-detail-section">
                <div className="recipe-detail-section-title">Method</div>
                <ol className="recipe-detail-steps">
                  {recipe.steps.map((step) => (
                    <li key={step.id}>
                      <span className="rds-num">{step.stepNumber}</span>
                      <span>{step.instructionText}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        ) : null}

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>Close</button>
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
  isPending,
}: {
  item: MealPlanItem
  onDelete: () => void
  onEdit: () => void
  onClick: () => void
  isPending: boolean
}) {
  // Shimmer state while recipe is being generated for this slot
  if (isPending) {
    return (
      <div className="meal-card meal-card--pending">
        <div className="meal-card-shimmer-line" />
        <div className="meal-card-shimmer-line meal-card-shimmer-line--short" />
        <span className="meal-card-generating-label">
          <Loader2 size={9} className="spin-icon" /> Generating recipe…
        </span>
      </div>
    )
  }

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

  const [weekStart, setWeekStart] = useState<Date>(() => getMondayOf(new Date()))
  const [addTarget, setAddTarget] = useState<SlotTarget | null>(null)
  const [editTarget, setEditTarget] = useState<MealPlanItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MealPlanItem | null>(null)
  const [showAI, setShowAI] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'error' } | null>(null)
  // IDs of meal plan items whose recipes are currently being generated
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set())
  // Progress counter for the generation banner
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null)
  // Recipe to show in the detail modal
  const [viewingRecipeId, setViewingRecipeId] = useState<string | null>(null)

  const weekStartISO = toISO(weekStart)
  const todayISO = toISO(new Date())

  const showToast = (msg: string, type: 'ok' | 'error' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Fetch week
  const { data: weekView, isLoading, isError } = useQuery<WeekView>({
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

  // AI generate — Phase 1: plan structure, Phase 2: sequential recipe generation
  const { mutate: generateAI, isPending: isGenerating } = useMutation({
    mutationFn: ({ preferences, targetDates, usePantry }: { preferences?: string; targetDates?: string[]; usePantry?: boolean }) =>
      mealPlanApi.generateAIMealPlan(weekStartISO, preferences, targetDates, usePantry),
    onSuccess: async (data) => {
      setShowAI(false)
      invalidate()

      const itemIds = data.newItemIds
      if (itemIds.length === 0) {
        showToast('Meal plan generated!')
        return
      }

      // Phase 2: generate full recipes one by one
      showToast(`Meal plan ready — generating ${itemIds.length} recipes…`)
      setPendingItemIds(new Set(itemIds))
      setGenProgress({ done: 0, total: itemIds.length })

      let completed = 0
      for (const id of itemIds) {
        try {
          await mealPlanApi.generateSlotRecipe(id)
          completed++
        } catch {
          // swallow individual failures — continue with remaining slots
        }
        setPendingItemIds(prev => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        setGenProgress({ done: completed, total: itemIds.length })
        // Refresh the planner view after each recipe is ready
        queryClient.invalidateQueries({ queryKey: ['meal-plan-week', weekStartISO] })
      }

      setPendingItemIds(new Set())
      setGenProgress(null)
      showToast(
        completed === itemIds.length
          ? 'All recipes ready!'
          : `Done — ${completed} of ${itemIds.length} recipes generated`,
        completed === itemIds.length ? 'ok' : 'error'
      )
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

      {/* ── Recipe generation progress banner ── */}
      <AnimatePresence>
        {genProgress && (
          <motion.div
            className="gen-progress-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Loader2 size={14} className="spin-icon" style={{ flexShrink: 0 }} />
            <span>Generating recipes… ({genProgress.done}/{genProgress.total})</span>
            <div className="gen-progress-track">
              <div
                className="gen-progress-fill"
                style={{ width: `${(genProgress.done / genProgress.total) * 100}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid ── */}
      {isLoading ? (
        <div className="planner-loading">
          <Loader2 size={28} className="spin-icon" />
        </div>
      ) : isError ? (
        <div className="planner-error">
          <Calendar size={32} />
          <p>Couldn't load your meal plan. Check your connection and try again.</p>
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
                          onDelete={() => setDeleteTarget(item)}
                          onEdit={() => setEditTarget(item)}
                          onClick={() => {
                            if (item.recipe) setViewingRecipeId(item.recipe.id)
                            else if (!pendingItemIds.has(item.id)) setEditTarget(item)
                          }}
                          isPending={pendingItemIds.has(item.id)}
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
      {!isLoading && !isError && (
        <div className="planner-bottom-grid">
          <NutritionProgressRings weekView={weekView} />
          <TodaysKitchen weekView={weekView} />
        </div>
      )}

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
            onConfirm={(prefs, targetDates, usePantry) => generateAI({ preferences: prefs, targetDates, usePantry })}
          />
        )}
      </AnimatePresence>

      {/* ── Delete confirm modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="planner-overlay" onClick={() => setDeleteTarget(null)}>
            <motion.div
              className="planner-confirm-modal"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
            >
              <p className="planner-confirm-title">Remove meal?</p>
              <p className="planner-confirm-body">
                "{deleteTarget.recipe?.title ?? deleteTarget.customMealName ?? 'This meal'}" will be removed from your plan.
              </p>
              <div className="planner-confirm-actions">
                <button className="planner-confirm-cancel" onClick={() => setDeleteTarget(null)}>Cancel</button>
                <button
                  className="planner-confirm-delete"
                  onClick={() => { deleteMeal(deleteTarget.id); setDeleteTarget(null) }}
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Recipe detail modal ── */}
      <AnimatePresence>
        {viewingRecipeId && (
          <RecipeDetailModal
            recipeId={viewingRecipeId}
            onClose={() => setViewingRecipeId(null)}
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
