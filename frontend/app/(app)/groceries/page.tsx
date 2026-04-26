'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence, type Variants } from 'framer-motion'
import { useState, useRef, useEffect } from 'react'
import {
  ShoppingCart, Trash2, Plus,
  RefreshCw, ChevronDown, ChevronUp, Sparkles,
  Check, X, ShoppingBag, Calendar, Package,
  Share2, Download, Copy, MessageCircle, CheckSquare, Square, AlertCircle,
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
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set())
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGenModal, setShowGenModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSharePopover, setShowSharePopover] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const shareRef = useRef<HTMLDivElement>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Queries ──────────────────────────────

  const { data: groceryData, isLoading, isError, refetch } = useQuery({
    queryKey: ['grocery-list'],
    queryFn: () => groceryApi.getGroceryList(),
    staleTime: 2 * 60 * 1000,
  })

  const { data: weekView } = useQuery({
    queryKey: ['meal-plan-week'],
    queryFn: () => mealPlanApi.getWeekView(),
    staleTime: 3 * 60 * 1000,
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
    mutationFn: ({
      mealPlanId,
      dates,
      mode,
    }: {
      mealPlanId: string
      dates: string[]
      mode: 'replace' | 'merge'
    }) => groceryApi.generateFromMealPlan(mealPlanId, { dates, mode }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['grocery-list'] })
      setShowGenModal(false)
      showToast(vars.mode === 'merge' ? 'Items added to your list!' : 'Grocery list generated!')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message
      showToast(msg || 'Failed to generate list', msg ? 'success' : 'error')
      if (msg) setShowGenModal(false)
    },
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
    mutationFn: async () => {
      const allItems = (list?.categories ?? []).flatMap(c => c.items)
      const checked = allItems.filter(i => i.isChecked)
      if (checked.length === 0) return 0
      const pantryItems = checked.map(i => ({
        ingredientName: i.ingredientName,
        ...(i.quantity !== null && { quantity: i.quantity }),
        ...(i.unit !== null && { unit: i.unit }),
      }))
      const added = await pantryApi.bulkAddItems(pantryItems)
      // If every item is checked, wipe the whole list; otherwise remove only those items
      if (checked.length === allItems.length && listId) {
        await groceryApi.deleteList(listId)
      } else {
        await Promise.all(checked.map(i => groceryApi.deleteItem(i.id)))
      }
      return added.length
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['grocery-list'] })
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      showToast(`${count} item${count !== 1 ? 's' : ''} moved to pantry`)
    },
    onError: () => showToast('Failed to move items to pantry', 'error'),
  })

  // ── Close share popover on outside click ─
  useEffect(() => {
    if (!showSharePopover) return
    const handler = (e: MouseEvent) => {
      if (shareRef.current && !shareRef.current.contains(e.target as Node)) {
        setShowSharePopover(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showSharePopover])

  // ── Share helpers ─────────────────────────

  // Only include unchecked (still-needed) items in the downloadable text
  const formatListAsText = (): string => {
    if (!list) return ''
    const lines: string[] = []
    const hr = '─'.repeat(38)

    lines.push('🛒  GROCERY LIST')
    lines.push(hr)

    let remaining = 0
    for (const cat of list.categories) {
      const unchecked = cat.items.filter(i => !i.isChecked)
      if (unchecked.length === 0) continue
      remaining += unchecked.length

      lines.push('')
      lines.push(`  ${cat.name.toUpperCase()}`)

      const maxLen = unchecked.reduce((m, i) => Math.max(m, i.ingredientName.length), 0)

      for (const item of unchecked) {
        const qty = item.quantity
          ? `${item.quantity}${item.unit ? ' ' + item.unit : ''}`
          : ''
        const pad = ' '.repeat(Math.max(2, maxLen - item.ingredientName.length + 4))
        lines.push(`    ${item.ingredientName}${qty ? pad + qty : ''}`)
      }
    }

    lines.push('')
    lines.push(hr)
    lines.push(`  ${remaining} item${remaining !== 1 ? 's' : ''} to buy`)

    return lines.join('\n')
  }

  const handleDownload = () => {
    const text = formatListAsText()
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'grocery-list.txt'
    a.click()
    URL.revokeObjectURL(url)
    setShowSharePopover(false)
    showToast('List downloaded!')
  }

  const handleWhatsApp = () => {
    const text = formatListAsText()
    const encoded = encodeURIComponent(text)
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
    setShowSharePopover(false)
  }

  const handleCopy = async () => {
    const text = formatListAsText()
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard!')
    } catch {
      showToast('Failed to copy', 'error')
    }
    setShowSharePopover(false)
  }

  const handleNativeShare = async () => {
    const text = formatListAsText()
    try {
      await navigator.share({ title: 'Grocery List', text })
    } catch {
      // User cancelled or API unavailable — silently ignore
    }
    setShowSharePopover(false)
  }

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
  const checkedCount = summary?.checkedItems ?? 0

  // Meal plan for generate — use current week's plan
  const weekDays = weekView?.days ?? []
  const mealPlanId = weekView?.mealPlan?.id ?? null

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
            <div className="gr-share-wrap" ref={shareRef}>
              <button
                className="gr-btn gr-btn--ghost"
                onClick={() => setShowSharePopover(v => !v)}
                title="Share grocery list"
              >
                <Share2 size={15} />
                Share
              </button>
              <AnimatePresence>
                {showSharePopover && (
                  <motion.div
                    className="gr-share-popover"
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                    transition={{ duration: 0.15 }}
                  >
                    <button className="gr-share-option" onClick={handleCopy}>
                      <Copy size={15} />
                      Copy to clipboard
                    </button>
                    <button className="gr-share-option" onClick={handleWhatsApp}>
                      <MessageCircle size={15} />
                      Send via WhatsApp
                    </button>
                    <button className="gr-share-option" onClick={handleDownload}>
                      <Download size={15} />
                      Download .txt
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button className="gr-share-option" onClick={handleNativeShare}>
                        <Share2 size={15} />
                        More options…
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
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
                transition={{ duration: 0.6, ease: 'easeOut' as const }}
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

      {/* ── Floating action bar — appears when any items are checked ── */}
      <AnimatePresence>
        {checkedCount > 0 && listId && (
          <motion.div
            className="gr-float-bar"
            initial={{ opacity: 0, y: 80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 80 }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <span className="gr-float-info">
              <Package size={15} />
              {checkedCount} item{checkedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="gr-float-actions">
              <button
                className="gr-float-btn gr-float-btn--primary"
                onClick={() => moveToPantryMutation.mutate()}
                disabled={moveToPantryMutation.isPending}
              >
                {moveToPantryMutation.isPending
                  ? <RefreshCw size={13} className="gr-spin" />
                  : <Package size={13} />}
                Move to pantry
              </button>
              <button
                className="gr-float-btn gr-float-btn--ghost"
                onClick={handleDownload}
                title="Download remaining items"
              >
                <Download size={13} />
                Download remaining
              </button>
              <button
                className="gr-float-btn gr-float-btn--clear"
                onClick={() => checkAllMutation.mutate({ listId, isChecked: false })}
                disabled={checkAllMutation.isPending}
                title="Uncheck all"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error state ── */}
      {isError && (
        <motion.div
          className="gr-empty"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="gr-empty-icon">
            <AlertCircle size={40} />
          </div>
          <h2>Failed to load grocery list</h2>
          <p>Something went wrong. Please try again.</p>
          <button className="gr-btn gr-btn--primary" onClick={() => refetch()}>
            <RefreshCw size={15} />
            Retry
          </button>
        </motion.div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !isError && !list && (
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

      {/* ── Delete list — subtle danger link below the list ── */}
      {listId && (
        <div className="gr-delete-row">
          <button
            className="gr-delete-link"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteListMutation.isPending}
          >
            <Trash2 size={13} />
            Delete grocery list
          </button>
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

      {/* ── Delete list confirm ── */}
      <AnimatePresence>
        {showDeleteConfirm && listId && (
          <div className="gr-overlay" onClick={() => setShowDeleteConfirm(false)}>
            <motion.div
              className="gr-confirm-modal"
              onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18 }}
            >
              <p className="gr-confirm-title">Delete grocery list?</p>
              <p className="gr-confirm-body">All items will be permanently removed. This cannot be undone.</p>
              <div className="gr-confirm-actions">
                <button className="gr-confirm-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button
                  className="gr-confirm-delete"
                  disabled={deleteListMutation.isPending}
                  onClick={() => { deleteListMutation.mutate(listId); setShowDeleteConfirm(false) }}
                >
                  {deleteListMutation.isPending ? 'Deleting…' : 'Yes, delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Generate modal ── */}
      <AnimatePresence>
        {showGenModal && (
          <GenerateModal
            mealPlanId={mealPlanId}
            weekDays={weekDays}
            hasExistingList={!!listId}
            isPending={generateMutation.isPending}
            onConfirm={(mealPlanId, dates, mode) =>
              generateMutation.mutate({ mealPlanId, dates, mode })
            }
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

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function GenerateModal({
  mealPlanId,
  weekDays,
  hasExistingList,
  isPending,
  onConfirm,
  onClose,
}: {
  mealPlanId: string | null
  weekDays: import('@/services/meal-plan.service').WeekDay[]
  hasExistingList: boolean
  isPending: boolean
  onConfirm: (mealPlanId: string, dates: string[], mode: 'replace' | 'merge') => void
  onClose: () => void
}) {
  // All 7 day dates selected by default
  const allDates = weekDays.map((d) => d.date)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set(allDates))
  const [mode, setMode] = useState<'replace' | 'merge'>(hasExistingList ? 'merge' : 'replace')

  const toggleDate = (date: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) {
        // Don't allow deselecting the last day
        if (next.size === 1) return prev
        next.delete(date)
      } else {
        next.add(date)
      }
      return next
    })
  }

  const selectAll = () => setSelectedDates(new Set(allDates))
  const selectToday = () => {
    const today = new Date().toISOString().split('T')[0]
    const match = allDates.find((d) => d.startsWith(today))
    if (match) setSelectedDates(new Set([match]))
  }

  // Stats for selected days
  const selectedMeals = weekDays
    .filter((d) => selectedDates.has(d.date))
    .flatMap((d) => [d.breakfast, d.lunch, d.dinner, d.snack].filter(Boolean))
  const recipeMeals = selectedMeals.filter((m) => m?.recipeId).length

  const canGenerate = !!mealPlanId && recipeMeals > 0 && !isPending

  return (
    <div className="gr-overlay" onClick={onClose}>
      <motion.div
        className="gr-modal gr-gen-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        {/* Header */}
        <div className="gr-gen-top">
          <div className="gr-gen-icon-wrap">
            <ShoppingCart size={22} />
          </div>
          <div className="gr-gen-title-block">
            <span className="gr-gen-ai-badge">
              <Sparkles size={11} /> AI Powered
            </span>
            <h2 className="gr-gen-title">Generate Grocery List</h2>
            <p className="gr-gen-sub">Choose which days to shop for.</p>
          </div>
          <button onClick={onClose} className="gr-modal-close gr-gen-close">
            <X size={18} />
          </button>
        </div>

        <div className="gr-gen-divider" />

        {/* Day picker */}
        <div className="gr-gen-section">
          <div className="gr-gen-section-hd">
            <span className="gr-gen-section-label">
              <Calendar size={13} /> Select days
            </span>
            <div className="gr-gen-section-links">
              <button className="gr-gen-link" onClick={selectToday}>Today</button>
              <button className="gr-gen-link" onClick={selectAll}>All week</button>
            </div>
          </div>
          <div className="gr-day-chips">
            {weekDays.map((day, i) => {
              const d = new Date(day.date)
              const dateNum = d.getUTCDate()
              const dayLabel = DAY_NAMES[i] ?? DAY_NAMES[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1]
              const active = selectedDates.has(day.date)
              const slots = [day.breakfast, day.lunch, day.dinner, day.snack].filter(Boolean)
              const hasRecipe = slots.some((s) => s?.recipeId)
              return (
                <button
                  key={day.date}
                  className={`gr-day-chip ${active ? 'gr-day-chip--active' : ''} ${!hasRecipe ? 'gr-day-chip--dim' : ''}`}
                  onClick={() => toggleDate(day.date)}
                >
                  <span className="gr-day-chip-name">{dayLabel}</span>
                  <span className="gr-day-chip-num">{dateNum}</span>
                  {hasRecipe && <span className="gr-day-chip-dot" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="gr-gen-stats-card" style={{ margin: '0 1.5rem 0.25rem' }}>
          {recipeMeals > 0 ? (
            <div className="gr-gen-stats-top">
              <span className="gr-gen-dot" />
              <span className="gr-gen-stats-text">
                <strong>{recipeMeals}</strong> meal{recipeMeals !== 1 ? 's' : ''} with recipes in selected days
              </span>
            </div>
          ) : (
            <div className="gr-gen-stats-top">
              <span className="gr-gen-dot gr-gen-dot--amber" />
              <span className="gr-gen-stats-text">
                {mealPlanId
                  ? 'No recipes in the selected days — add recipes to your meal plan first.'
                  : 'No meal plan found for this week.'}
              </span>
            </div>
          )}
        </div>

        {/* Mode selector — only shown when a list already exists */}
        {hasExistingList && (
          <div className="gr-gen-section">
            <div className="gr-gen-section-hd">
              <span className="gr-gen-section-label">Existing list</span>
            </div>
            <div className="gr-mode-cards">
              <button
                className={`gr-mode-card ${mode === 'merge' ? 'gr-mode-card--active' : ''}`}
                onClick={() => setMode('merge')}
              >
                <span className="gr-mode-card-icon">➕</span>
                <div>
                  <span className="gr-mode-card-title">Merge</span>
                  <span className="gr-mode-card-desc">Add new items — keep existing ones</span>
                </div>
              </button>
              <button
                className={`gr-mode-card ${mode === 'replace' ? 'gr-mode-card--active' : ''}`}
                onClick={() => setMode('replace')}
              >
                <span className="gr-mode-card-icon">🔄</span>
                <div>
                  <span className="gr-mode-card-title">Replace</span>
                  <span className="gr-mode-card-desc">Start fresh, delete current list</span>
                </div>
              </button>
            </div>
          </div>
        )}

        <div className="gr-gen-divider" style={{ marginTop: '1.25rem' }} />

        {/* Actions */}
        <div className="gr-modal-actions">
          <button className="gr-btn gr-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="gr-btn gr-btn--primary"
            disabled={!canGenerate}
            onClick={() =>
              mealPlanId && onConfirm(mealPlanId, Array.from(selectedDates), mode)
            }
          >
            {isPending ? (
              <>
                <RefreshCw size={14} className="gr-spin" /> Generating…
              </>
            ) : mode === 'merge' ? (
              <>Add to List ›</>
            ) : (
              <>Generate List ›</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
