'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ShoppingCart, CheckSquare, Square, Trash2, Plus,
  RefreshCw, ChevronDown, ChevronUp, Sparkles,
  Check, X, ShoppingBag, Calendar, Package
} from 'lucide-react'
import {
  groceryApi,
  GroceryItem,
  AddGroceryItemPayload,
} from '@/services/grocery.service'
import { pantryApi } from '@/services/pantry.service'
import { mealPlanApi } from '@/services/meal-plan.service'
import './groceries.css'

// ── Animation variants ───────────────────
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.4, 0, 0.2, 1] },
  }),
}

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25 } },
  exit: { opacity: 0, x: 12, transition: { duration: 0.2 } },
}

export default function GroceriesPage() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Queries ──────────────────────────────

  const { data: groceryData, isLoading } = useQuery({
    queryKey: ['grocery-list'],
    queryFn: () => groceryApi.getGroceryList(),
  })

  const { data: weekView } = useQuery({
    queryKey: ['meal-plan-week'],
    queryFn: () => mealPlanApi.getWeekView(),
  })

  // ── Mutations ────────────────────────────

  const checkItemMutation = useMutation({
    mutationFn: ({ id, isChecked }: { id: string; isChecked: boolean }) =>
      groceryApi.updateItem(id, { isChecked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-list'] }),
  })

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => groceryApi.deleteItem(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-list'] }),
  })

  const checkAllMutation = useMutation({
    mutationFn: ({ listId, isChecked }: { listId: string; isChecked: boolean }) =>
      groceryApi.checkAll(listId, isChecked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grocery-list'] }),
  })

  const generateMutation = useMutation({
    mutationFn: (mealPlanId: string) => groceryApi.generateFromMealPlan(mealPlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-list'] })
      setShowGenModal(false)
      showToast('Grocery list generated!')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to generate list', 'error'),
  })

  const deleteListMutation = useMutation({
    mutationFn: (id: string) => groceryApi.deleteList(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grocery-list'] })
      showToast('Grocery list cleared')
    },
    onError: () => showToast('Failed to delete list', 'error'),
  })

  const moveToPantryMutation = useMutation({
    mutationFn: async (listId: string) => {
      // Collect all items from all categories
      const allItems = (list?.categories ?? [])
        .flatMap(c => c.items)
        .map(i => ({
          ingredientName: i.ingredientName,
          ...(i.quantity !== null && { quantity: i.quantity }),
          ...(i.unit !== null && { unit: i.unit }),
        }))
      const added = await pantryApi.bulkAddItems(allItems)
      await groceryApi.deleteList(listId)
      return added.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['grocery-list'] })
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      showToast(`${count} item${count !== 1 ? 's' : ''} added to your pantry 📦`)
      router.push('/pantry')
    },
    onError: () => showToast('Failed to move items to pantry', 'error'),
  })

  // ── Helpers ──────────────────────────────

  const toggleCategory = (name: string) => {
    setCollapsedCats(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const list = groceryData
  const listId = list?.list?.id
  const summary = list?.summary
  const allChecked = summary ? summary.remainingItems === 0 && summary.totalItems > 0 : false

  // Meal plan for generate — use current week's plan
  const weekDays = weekView?.days ?? []
  const mealPlanId = weekView?.mealPlan?.id ?? null

  // Count all filled slots and those with linked recipes
  const allSlots = weekDays.flatMap(d => [d.breakfast, d.lunch, d.dinner, d.snack].filter(Boolean))
  const totalMeals = allSlots.length
  const mealsWithRecipes = allSlots.filter(m => m?.recipeId).length


  return (
    <div className="gr-root">
      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`gr-toast gr-toast--${toast.type}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <motion.header
        className="gr-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <p className="gr-eyebrow">Shopping</p>
          <h1 className="gr-title">Grocery List</h1>
        </div>
        <div className="gr-header-actions">
          {listId && (
            <button
              className="gr-btn gr-btn--ghost"
              onClick={() => checkAllMutation.mutate({ listId, isChecked: !allChecked })}
              disabled={checkAllMutation.isPending}
            >
              {allChecked ? <CheckSquare size={16} /> : <Square size={16} />}
              {allChecked ? 'Uncheck all' : 'Check all'}
            </button>
          )}
          <button
            className="gr-btn gr-btn--secondary"
            onClick={() => setShowGenModal(true)}
          >
            <Sparkles size={15} />
            Generate from plan
          </button>
          {listId && (
            <button
              className="gr-btn gr-btn--primary"
              onClick={() => setShowAddModal(true)}
            >
              <Plus size={15} />
              Add item
            </button>
          )}
          {listId && (
            <button
              className="gr-btn-delete-list"
              onClick={() => deleteListMutation.mutate(listId)}
              disabled={deleteListMutation.isPending}
              title="Delete grocery list"
            >
              <Trash2 size={14} />
              Delete list
            </button>
          )}
        </div>
      </motion.header>

      {/* ── Summary bar ── */}
      {summary && (
        <motion.div
          className="gr-summary"
          custom={0} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <div className="gr-summary-stat">
            <span className="gr-summary-num">{summary.totalItems}</span>
            <span className="gr-summary-label">Total items</span>
          </div>
          <div className="gr-summary-divider" />
          <div className="gr-summary-stat">
            <span className="gr-summary-num gr-summary-num--checked">{summary.checkedItems}</span>
            <span className="gr-summary-label">In cart</span>
          </div>
          <div className="gr-summary-divider" />
          <div className="gr-summary-stat">
            <span className="gr-summary-num gr-summary-num--remaining">{summary.remainingItems}</span>
            <span className="gr-summary-label">Remaining</span>
          </div>

          {/* Progress bar */}
          <div className="gr-progress-wrap">
            <div className="gr-progress-track">
              <motion.div
                className="gr-progress-fill"
                initial={{ width: 0 }}
                animate={{
                  width: summary.totalItems > 0
                    ? `${(summary.checkedItems / summary.totalItems) * 100}%`
                    : '0%'
                }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
            <span className="gr-progress-pct">
              {summary.totalItems > 0
                ? Math.round((summary.checkedItems / summary.totalItems) * 100)
                : 0}%
            </span>
          </div>
        </motion.div>
      )}

      {/* ── Shopping Done banner ── */}
      <AnimatePresence>
        {allChecked && listId && (
          <motion.div
            className="gr-done-banner"
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div className="gr-done-content">
              <div className="gr-done-emoji">🎉</div>
              <div>
                <h3 className="gr-done-heading">You got everything!</h3>
                <p className="gr-done-sub">What would you like to do with your list?</p>
              </div>
            </div>
            <div className="gr-done-actions">
              <button
                className="gr-btn gr-btn--primary"
                onClick={() => moveToPantryMutation.mutate(listId)}
                disabled={moveToPantryMutation.isPending || deleteListMutation.isPending}
              >
                {moveToPantryMutation.isPending
                  ? <RefreshCw size={14} className="gr-spin" />
                  : <Package size={14} />
                }
                Move to Pantry
              </button>
              <button
                className="gr-btn gr-btn--danger"
                onClick={() => deleteListMutation.mutate(listId)}
                disabled={deleteListMutation.isPending || moveToPantryMutation.isPending}
              >
                {deleteListMutation.isPending
                  ? <RefreshCw size={14} className="gr-spin" />
                  : <Trash2 size={14} />
                }
                Clear List
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {!isLoading && !list && (
        <motion.div
          className="gr-empty"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="gr-empty-icon">
            <ShoppingBag size={40} />
          </div>
          <h2>No grocery list yet</h2>
          <p>Generate a list from your weekly meal plan to get started.</p>
          <button
            className="gr-btn gr-btn--primary"
            onClick={() => setShowGenModal(true)}
          >
            <Sparkles size={15} />
            Generate grocery list
          </button>
        </motion.div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="gr-loading">
          {[1, 2, 3].map(i => (
            <div key={i} className="gr-skeleton-cat">
              <div className="gr-skeleton-header" />
              {[1, 2, 3].map(j => (
                <div key={j} className="gr-skeleton-item" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Categories ── */}
      {list && (
        <div className="gr-categories">
          {list.categories.map((cat, catIdx) => (
            <motion.div
              key={cat.name}
              className="gr-category"
              custom={catIdx}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
            >
              {/* Category header */}
              <button
                className="gr-cat-header"
                onClick={() => toggleCategory(cat.name)}
              >
                <div className="gr-cat-header-left">
                  <span className="gr-cat-dot" data-cat={cat.name} />
                  <span className="gr-cat-name">{cat.name}</span>
                  <span className="gr-cat-count">
                    {cat.items.filter(i => i.isChecked).length}/{cat.items.length}
                  </span>
                </div>
                {collapsedCats.has(cat.name) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
              </button>

              {/* Items */}
              <AnimatePresence>
                {!collapsedCats.has(cat.name) && (
                  <motion.ul
                    className="gr-items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {cat.items.map(item => (
                      <GroceryItemRow
                        key={item.id}
                        item={item}
                        onToggle={() =>
                          checkItemMutation.mutate({
                            id: item.id,
                            isChecked: !item.isChecked,
                          })
                        }
                        onDelete={() => deleteItemMutation.mutate(item.id)}
                      />
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Add item modal ── */}
      <AnimatePresence>
        {showAddModal && listId && (
          <AddItemModal
            listId={listId}
            onClose={() => setShowAddModal(false)}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['grocery-list'] })
              showToast('Item added!')
            }}
            onError={(msg) => showToast(msg, 'error')}
          />
        )}
      </AnimatePresence>

      {/* ── Generate modal ── */}
      <AnimatePresence>
        {showGenModal && (
          <GenerateModal
            mealPlanId={mealPlanId}
            totalMeals={totalMeals}
            mealsWithRecipes={mealsWithRecipes}
            weekStartDate={weekView?.weekStartDate ?? null}
            weekEndDate={weekView?.weekEndDate ?? null}
            isPending={generateMutation.isPending}
            onConfirm={(id) => generateMutation.mutate(id)}
            onClose={() => setShowGenModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Grocery item row ─────────────────────

function GroceryItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: GroceryItem
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <motion.li
      className={`gr-item ${item.isChecked ? 'gr-item--checked' : ''}`}
      variants={itemVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <button className="gr-item-check" onClick={onToggle} aria-label="toggle">
        {item.isChecked
          ? <CheckSquare size={18} className="gr-check-icon gr-check-icon--on" />
          : <Square size={18} className="gr-check-icon" />
        }
      </button>
      <span className="gr-item-name">{item.ingredientName}</span>
      {(item.quantity || item.unit) && (
        <span className="gr-item-qty">
          {item.quantity ? item.quantity : ''}{item.unit ? ` ${item.unit}` : ''}
        </span>
      )}
      <button
        className="gr-item-delete"
        onClick={onDelete}
        aria-label="delete"
      >
        <Trash2 size={14} />
      </button>
    </motion.li>
  )
}

// ── Add item modal ───────────────────────

function AddItemModal({
  listId,
  onClose,
  onSuccess,
  onError,
}: {
  listId: string
  onClose: () => void
  onSuccess: () => void
  onError: (msg: string) => void
}) {
  const [form, setForm] = useState<AddGroceryItemPayload>({
    ingredientName: '',
    quantity: undefined,
    unit: '',
    category: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ingredientName.trim()) return
    setLoading(true)
    try {
      await groceryApi.addItem(listId, {
        ingredientName: form.ingredientName.trim(),
        quantity: form.quantity || undefined,
        unit: form.unit || undefined,
        category: form.category || undefined,
      })
      onSuccess()
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add item'
      onError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="gr-overlay" onClick={onClose}>
      <motion.div
        className="gr-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
      >
        <div className="gr-modal-header">
          <h2>Add item</h2>
          <button onClick={onClose} className="gr-modal-close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="gr-modal-form">
          <label className="gr-label">
            Item name *
            <input
              className="gr-input"
              placeholder="e.g. Chicken breast"
              value={form.ingredientName}
              onChange={e => setForm(f => ({ ...f, ingredientName: e.target.value }))}
              autoFocus
            />
          </label>
          <div className="gr-row">
            <label className="gr-label gr-label--half">
              Quantity
              <input
                className="gr-input"
                type="number"
                min="0"
                step="any"
                placeholder="e.g. 500"
                value={form.quantity ?? ''}
                onChange={e => setForm(f => ({
                  ...f,
                  quantity: e.target.value ? Number(e.target.value) : undefined
                }))}
              />
            </label>
            <label className="gr-label gr-label--half">
              Unit
              <input
                className="gr-input"
                placeholder="e.g. g, ml, pcs"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              />
            </label>
          </div>
          <label className="gr-label">
            Category
            <select
              className="gr-input"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              <option value="">Auto-detect</option>
              {['Produce', 'Meat & Seafood', 'Dairy', 'Pantry', 'Canned & Jarred', 'Spices & Herbs', 'Bakery', 'Frozen', 'Beverages', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="gr-modal-actions">
            <button type="button" className="gr-btn gr-btn--ghost" onClick={onClose}>Cancel</button>
            <button
              type="submit"
              className="gr-btn gr-btn--primary"
              disabled={loading || !form.ingredientName.trim()}
            >
              {loading ? <RefreshCw size={14} className="gr-spin" /> : <Plus size={14} />}
              Add item
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Generate modal ───────────────────────

function formatWeekRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sDay = s.getUTCDate()
  const eDay = e.getUTCDate()
  const sMon = s.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  const eMon = e.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })
  const year = e.getUTCFullYear()
  if (sMon === eMon) return `${sDay}–${eDay} ${sMon} ${year}`
  return `${sDay} ${sMon} – ${eDay} ${eMon} ${year}`
}

function GenerateModal({
  mealPlanId,
  totalMeals,
  mealsWithRecipes,
  weekStartDate,
  weekEndDate,
  isPending,
  onConfirm,
  onClose,
}: {
  mealPlanId: string | null
  totalMeals: number
  mealsWithRecipes: number
  weekStartDate: string | null
  weekEndDate: string | null
  isPending: boolean
  onConfirm: (id: string) => void
  onClose: () => void
}) {
  const customMeals = totalMeals - mealsWithRecipes
  const canGenerate = !!mealPlanId && mealsWithRecipes > 0

  return (
    <div className="gr-overlay" onClick={onClose}>
      <motion.div
        className="gr-modal gr-gen-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        {/* Header row */}
        <div className="gr-gen-top">
          <div className="gr-gen-icon-wrap">
            <ShoppingCart size={22} />
          </div>
          <div className="gr-gen-title-block">
            <span className="gr-gen-ai-badge">
              <Sparkles size={11} /> AI Powered
            </span>
            <h2 className="gr-gen-title">Generate Grocery List</h2>
            <p className="gr-gen-sub">We'll scan your meal plan and compile everything you need to shop for.</p>
          </div>
          <button onClick={onClose} className="gr-modal-close gr-gen-close"><X size={18} /></button>
        </div>

        <div className="gr-gen-divider" />

        {/* Week row */}
        {weekStartDate && weekEndDate && (
          <div className="gr-gen-week-row">
            <Calendar size={16} className="gr-gen-week-icon" />
            <span className="gr-gen-week-label">Week of</span>
            <span className="gr-gen-week-val">{formatWeekRange(weekStartDate, weekEndDate)}</span>
          </div>
        )}

        {/* Stats card */}
        {totalMeals > 0 ? (
          <div className="gr-gen-stats-card">
            <div className="gr-gen-stats-top">
              <span className="gr-gen-dot" />
              <span className="gr-gen-stats-text">
                <strong>{mealsWithRecipes}</strong> of {totalMeals} meals have full recipes
              </span>
            </div>
            {customMeals > 0 && (
              <p className="gr-gen-stats-note">
                {customMeals} custom meal{customMeals > 1 ? 's' : ''} without recipes won't contribute to your grocery list.
                Use ✨ AI interpret in the planner to fix this.
              </p>
            )}
          </div>
        ) : (
          <div className="gr-gen-stats-card gr-gen-stats-card--empty">
            <span className="gr-gen-dot gr-gen-dot--amber" />
            <span className="gr-gen-stats-text">No meals found in your current week's plan.</span>
          </div>
        )}

        {/* Steps */}
        <ol className="gr-gen-steps">
          {[
            'Scan all recipes in this week\'s meal plan',
            'Merge duplicate ingredients automatically',
            'Sort items by grocery category for easy shopping',
          ].map((step, i) => (
            <li key={i} className="gr-gen-step">
              <span className="gr-gen-step-num">{i + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="gr-gen-divider" />

        {/* Actions */}
        <div className="gr-modal-actions">
          <button className="gr-btn gr-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="gr-btn gr-btn--primary"
            disabled={!canGenerate || isPending}
            onClick={() => mealPlanId && onConfirm(mealPlanId)}
          >
            {isPending
              ? <><RefreshCw size={14} className="gr-spin" /> Generating…</>
              : <>Generate List ›</>
            }
          </button>
        </div>
      </motion.div>
    </div>
  )
}
