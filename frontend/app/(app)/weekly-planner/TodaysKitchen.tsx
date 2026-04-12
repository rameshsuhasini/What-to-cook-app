'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Check } from 'lucide-react'
import {
  WeekView,
  WeekDay,
  MealType,
  MealPlanItem,
  mealPlanApi,
} from '@/services/meal-plan.service'
import { recipeApi, Recipe } from '@/services/recipe.service'

// ── Types ─────────────────────────────────────────────────

interface TodaysKitchenProps {
  weekView: WeekView | undefined
}

interface AccordionItemProps {
  slotConfig: SlotConfig
  item: MealPlanItem | null
  recipe: Recipe | undefined
  isRecipeLoading: boolean
  isExpanded: boolean
  isDone: boolean
  onToggle: () => void
  onMarkDone: () => void
}

interface SlotConfig {
  key: MealType
  label: string
  icon: string
}

// ── Constants ─────────────────────────────────────────────

const SLOT_CONFIG: SlotConfig[] = [
  { key: 'BREAKFAST', label: 'Breakfast', icon: '🌅' },
  { key: 'LUNCH',     label: 'Lunch',     icon: '☀️' },
  { key: 'DINNER',    label: 'Dinner',    icon: '🌙' },
  { key: 'SNACK',     label: 'Snack',     icon: '🍎' },
]

// ── Helpers ───────────────────────────────────────────────

function formatTodayDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

// ── Skeleton loader ───────────────────────────────────────

function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  )
}

function AccordionSkeleton() {
  return (
    <div className="accordion-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="skeleton-line" />
      ))}
    </div>
  )
}

// ── AccordionItem ─────────────────────────────────────────

function AccordionItem({
  slotConfig,
  item,
  recipe,
  isRecipeLoading,
  isExpanded,
  isDone,
  onToggle,
  onMarkDone,
}: AccordionItemProps) {
  const isEmpty = !item
  const hasRecipe = !!(item?.recipeId)
  const isCustomOnly = !!(item && !item.recipeId && item.customMealName)

  // Total time shown in header (only when recipe is loaded)
  const totalTime = recipe
    ? (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)
    : 0

  const headerClasses = [
    'meal-accordion-header',
    isEmpty ? 'slot-empty' : '',
    isDone ? 'meal-slot-done' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="meal-accordion-item">
      <button
        className={headerClasses}
        onClick={isEmpty ? undefined : onToggle}
        disabled={isEmpty}
        type="button"
      >
        <span className="meal-slot-icon">{slotConfig.icon}</span>
        <span className="meal-slot-type">{slotConfig.label}</span>

        {isEmpty ? (
          <span className="meal-slot-name">Nothing planned</span>
        ) : (
          <>
            <span className="meal-slot-name">
              {isCustomOnly && (
                <span style={{ marginRight: 4 }}>⚠️</span>
              )}
              {item.recipe?.title ?? item.customMealName ?? 'Meal'}
              {isDone && (
                <Check
                  size={12}
                  style={{
                    marginLeft: 6,
                    color: 'var(--teal-400)',
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  }}
                />
              )}
            </span>

            {totalTime > 0 && (
              <span className="meal-slot-time">{totalTime}min</span>
            )}

            {/* Chevron rotates 90° when expanded */}
            <motion.span
              animate={{ rotate: isExpanded ? 90 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexShrink: 0, color: 'var(--text-muted)' }}
            >
              <ChevronRight size={14} />
            </motion.span>
          </>
        )}
      </button>

      {/* Animated expand body */}
      <AnimatePresence initial={false}>
        {isExpanded && !isEmpty && (
          <motion.div
            className="meal-expand-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {isCustomOnly ? (
              // Custom meal with no linked recipe
              <div className="custom-meal-warning">
                No recipe linked. Go to the planner and use ✨ AI Interpret to add
                ingredients and steps.
              </div>
            ) : isRecipeLoading ? (
              // Loading skeleton while recipe details fetch
              <AccordionSkeleton />
            ) : recipe ? (
              // Full recipe details
              <>
                {recipe.ingredients.length > 0 && (
                  <>
                    <div className="expand-section-title">Ingredients</div>
                    <ul className="ing-list">
                      {recipe.ingredients.map((ing) => (
                        <li key={ing.id}>
                          <span className="ing-bullet" />
                          <span className="ing-name">{ing.ingredientName}</span>
                          {(ing.quantity != null || ing.unit) && (
                            <span className="ing-qty">
                              {ing.quantity != null ? ing.quantity : ''}{' '}
                              {ing.unit ?? ''}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {recipe.steps.length > 0 && (
                  <>
                    <div className="expand-section-title">Steps</div>
                    <ol className="steps-list-kitchen">
                      {[...recipe.steps]
                        .sort((a, b) => a.stepNumber - b.stepNumber)
                        .map((step) => (
                          <li key={step.id}>
                            <span className="step-num-circle">{step.stepNumber}</span>
                            <span>{step.instructionText}</span>
                          </li>
                        ))}
                    </ol>
                  </>
                )}

                <div className="mark-done-wrap">
                  <button
                    className={`btn-mark-done${isDone ? ' done' : ''}`}
                    onClick={onMarkDone}
                    type="button"
                  >
                    <Check size={12} />
                    {isDone ? 'Done!' : 'Mark as done'}
                  </button>
                </div>
              </>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── TodaysKitchen ─────────────────────────────────────────

export function TodaysKitchen({ weekView }: TodaysKitchenProps) {
  const todayStr = new Date().toISOString().split('T')[0]

  const [expandedSlot, setExpandedSlot] = useState<MealType | null>(null)
  const [doneSlots, setDoneSlots] = useState<Set<MealType>>(new Set())

  // Try to find today in the already-fetched week view first
  const todayInView = weekView?.days?.find((d) => d.date === todayStr)

  // If today is not in the currently viewed week, fetch today's week separately
  const { data: todayWeekData, isLoading: isTodayLoading } = useQuery<WeekView>({
    queryKey: ['week-view-today', todayStr],
    queryFn: () => mealPlanApi.getWeekView(todayStr),
    enabled: !todayInView,
  })

  const todayData: WeekDay | undefined =
    todayInView ?? todayWeekData?.days?.find((d) => d.date === todayStr)

  // Extract per-slot recipe IDs (null when slot is empty or custom-only)
  const bfRecipeId     = todayData?.breakfast?.recipeId ?? null
  const lunchRecipeId  = todayData?.lunch?.recipeId     ?? null
  const dinnerRecipeId = todayData?.dinner?.recipeId    ?? null
  const snackRecipeId  = todayData?.snack?.recipeId     ?? null

  // Fetch full recipe details for each slot (4 fixed hooks — rules of hooks)
  const { data: bfRecipe,     isLoading: bfLoading     } = useQuery<Recipe>({
    queryKey: ['recipe', bfRecipeId],
    queryFn:  () => recipeApi.getRecipeById(bfRecipeId!),
    enabled:  !!bfRecipeId,
  })
  const { data: lunchRecipe,  isLoading: lunchLoading  } = useQuery<Recipe>({
    queryKey: ['recipe', lunchRecipeId],
    queryFn:  () => recipeApi.getRecipeById(lunchRecipeId!),
    enabled:  !!lunchRecipeId,
  })
  const { data: dinnerRecipe, isLoading: dinnerLoading } = useQuery<Recipe>({
    queryKey: ['recipe', dinnerRecipeId],
    queryFn:  () => recipeApi.getRecipeById(dinnerRecipeId!),
    enabled:  !!dinnerRecipeId,
  })
  const { data: snackRecipe,  isLoading: snackLoading  } = useQuery<Recipe>({
    queryKey: ['recipe', snackRecipeId],
    queryFn:  () => recipeApi.getRecipeById(snackRecipeId!),
    enabled:  !!snackRecipeId,
  })

  const recipesBySlot: Record<MealType, Recipe | undefined> = {
    BREAKFAST: bfRecipe,
    LUNCH:     lunchRecipe,
    DINNER:    dinnerRecipe,
    SNACK:     snackRecipe,
  }

  const loadingBySlot: Record<MealType, boolean> = {
    BREAKFAST: bfLoading,
    LUNCH:     lunchLoading,
    DINNER:    dinnerLoading,
    SNACK:     snackLoading,
  }

  // Sum total cook time for all today's loaded recipes
  const totalCookTime = Object.values(recipesBySlot).reduce<number>((acc, r) => {
    if (!r) return acc
    return acc + (r.prepTimeMinutes ?? 0) + (r.cookTimeMinutes ?? 0)
  }, 0)

  const hasMeals = !!(
    todayData &&
    (todayData.breakfast || todayData.lunch || todayData.dinner || todayData.snack)
  )

  function toggleSlot(slot: MealType): void {
    setExpandedSlot((prev) => (prev === slot ? null : slot))
  }

  function markDone(slot: MealType): void {
    setDoneSlots((prev) => {
      const next = new Set(prev)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  return (
    <div className="kitchen-card">
      {/* Header */}
      <div className="kitchen-header">
        <div>
          <div className="kitchen-title">Today's Kitchen 🍳</div>
          <div className="kitchen-date">{formatTodayDate(todayStr)}</div>
        </div>
        {totalCookTime > 0 && (
          <span className="kitchen-time-badge">~{totalCookTime} min total</span>
        )}
      </div>

      {/* Content */}
      {isTodayLoading && !todayInView ? (
        <SkeletonRows />
      ) : !hasMeals ? (
        <div className="kitchen-empty">
          <div className="kitchen-empty-icon">📅</div>
          <h4>Nothing planned for today</h4>
          <p>Add meals to the planner above to see your cooking guide here.</p>
        </div>
      ) : (
        <div>
          {SLOT_CONFIG.map((slotCfg) => {
            const slotKey = slotCfg.key.toLowerCase() as keyof WeekDay
            const item = (todayData?.[slotKey] as MealPlanItem | null) ?? null
            return (
              <AccordionItem
                key={slotCfg.key}
                slotConfig={slotCfg}
                item={item}
                recipe={recipesBySlot[slotCfg.key]}
                isRecipeLoading={loadingBySlot[slotCfg.key]}
                isExpanded={expandedSlot === slotCfg.key}
                isDone={doneSlots.has(slotCfg.key)}
                onToggle={() => toggleSlot(slotCfg.key)}
                onMarkDone={() => markDone(slotCfg.key)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
