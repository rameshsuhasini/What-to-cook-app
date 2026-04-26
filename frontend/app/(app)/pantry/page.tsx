'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Package, Plus, Trash2, Search, RefreshCw,
  X, Check, Edit2, AlertTriangle, CheckSquare, MoreHorizontal,
} from 'lucide-react'
import {
  pantryApi,
  PantryItem,
  AddPantryItemPayload,
  UpdatePantryItemPayload,
} from '@/services/pantry.service'
import './pantry.css'

// ── Category inference ───────────────────
// Priority order matters — first match wins

const CATEGORY_KEYWORDS: [string[], string][] = [
  [['tomato', 'lettuce', 'spinach', 'onion', 'garlic', 'potato', 'carrot', 'broccoli',
    'mushroom', 'cucumber', 'zucchini', 'courgette', 'lemon', 'lime', 'avocado',
    'banana', 'apple', 'berry', 'orange', 'mango', 'grape', 'celery', 'asparagus',
    'kale', 'cabbage', 'cauliflower', 'corn', 'pumpkin', 'squash', 'beet', 'leek',
    'scallion', 'spring onion', 'cilantro', 'parsley', 'mint', 'chili', 'eggplant',
    'aubergine', 'capsicum', 'bell pepper', 'fresh herb', 'radish', 'artichoke',
    'fennel', 'bok choy'], 'Produce'],
  [['chicken', 'beef', 'pork', 'lamb', 'turkey', 'salmon', 'tuna', 'shrimp', 'prawn',
    'fish', 'bacon', 'sausage', 'crab', 'lobster', 'duck', 'anchovy', 'cod', 'tilapia',
    'mince', 'steak', 'fillet', 'ham', 'pepperoni', 'chorizo', 'salami',
    'meat', 'seafood', 'veal', 'venison'], 'Meat & Seafood'],
  [['milk', 'cheese', 'butter', 'cream', 'yogurt', 'egg', 'mozzarella', 'parmesan',
    'cheddar', 'brie', 'feta', 'ricotta', 'mascarpone', 'ghee', 'cottage', 'paneer',
    'sour cream', 'whipping cream', 'dairy'], 'Dairy & Eggs'],
  [['canned', 'tinned', 'tomato paste', 'coconut milk', 'kidney bean', 'black bean',
    'chickpea', 'jar', 'pickle', 'paste', 'curry paste'], 'Canned & Jarred'],
  [['cumin', 'paprika', 'cinnamon', 'turmeric', 'oregano', 'thyme', 'rosemary',
    'bay leaf', 'cardamom', 'nutmeg', 'allspice', 'cayenne', 'black pepper',
    'white pepper', 'mustard seed', 'fennel seed', 'coriander seed', 'garam masala',
    'curry powder', 'spice', 'seasoning', 'dried herb', 'flake', 'powder',
    'chilli powder', 'smoked'], 'Spices & Herbs'],
  [['bread', 'roll', 'bun', 'naan', 'pita', 'tortilla', 'wrap', 'crumpet', 'bagel',
    'sourdough', 'loaf', 'brioche'], 'Bakery'],
  [['frozen'], 'Frozen'],
  [['juice', 'tea', 'coffee', 'wine', 'beer', 'soda', 'drink', 'beverage'], 'Beverages'],
  [['flour', 'sugar', 'salt', 'oil', 'vinegar', 'soy sauce', 'pasta', 'rice', 'noodle',
    'oat', 'cereal', 'nut', 'almond', 'cashew', 'walnut', 'peanut', 'sesame', 'tahini',
    'honey', 'maple', 'syrup', 'cocoa', 'chocolate', 'vanilla', 'baking powder',
    'baking soda', 'cornstarch', 'stock', 'broth', 'quinoa', 'couscous', 'barley',
    'lentil', 'bean', 'legume'], 'Pantry'],
]

function inferCategory(name: string): string {
  const lower = name.toLowerCase()
  for (const [keywords, category] of CATEGORY_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) return category
  }
  return 'Other'
}

// ── Shelf visual metadata ────────────────

const SHELF_ORDER = [
  'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Pantry',
  'Canned & Jarred', 'Spices & Herbs', 'Bakery', 'Frozen', 'Beverages', 'Other',
]

const SHELF_META: Record<string, {
  emoji: string; bg: string; border: string; board: string; chipBg: string
}> = {
  'Produce':        { emoji: '🥬', bg: '#f2faf5', border: 'rgba(46,158,91,0.22)',   board: '#82c09a', chipBg: 'rgba(46,158,91,0.07)'  },
  'Meat & Seafood': { emoji: '🥩', bg: '#fdf4f1', border: 'rgba(216,90,48,0.22)',   board: '#cc8068', chipBg: 'rgba(216,90,48,0.07)'  },
  'Dairy & Eggs':   { emoji: '🧀', bg: '#fdf8ee', border: 'rgba(186,117,23,0.22)',  board: '#c9973a', chipBg: 'rgba(186,117,23,0.07)' },
  'Pantry':         { emoji: '🫙', bg: '#faf9f6', border: 'rgba(164,120,80,0.25)',  board: '#b8916a', chipBg: 'rgba(164,120,80,0.07)' },
  'Canned & Jarred':{ emoji: '🥫', bg: '#f6f5fc', border: 'rgba(139,92,246,0.2)',   board: '#9b7fd4', chipBg: 'rgba(139,92,246,0.06)' },
  'Spices & Herbs': { emoji: '🌿', bg: '#f4faf3', border: 'rgba(56,142,60,0.2)',    board: '#8dba8a', chipBg: 'rgba(56,142,60,0.07)'  },
  'Bakery':         { emoji: '🥖', bg: '#fdf9f0', border: 'rgba(212,162,71,0.25)',  board: '#c49535', chipBg: 'rgba(212,162,71,0.07)' },
  'Frozen':         { emoji: '🧊', bg: '#f1f7fd', border: 'rgba(55,138,221,0.22)',  board: '#6aa8d8', chipBg: 'rgba(55,138,221,0.07)' },
  'Beverages':      { emoji: '🥤', bg: '#f1f5fd', border: 'rgba(59,130,246,0.22)',  board: '#7ba8e8', chipBg: 'rgba(59,130,246,0.07)' },
  'Other':          { emoji: '📦', bg: '#f9f9f8', border: 'rgba(138,136,128,0.2)',  board: '#aaa89a', chipBg: 'rgba(138,136,128,0.07)'},
}

const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'cups', 'tbsp', 'tsp', 'oz', 'lb']

export default function PantryPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState<PantryItem | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  // Per-shelf select mode
  const [shelfSelectMode, setShelfSelectMode] = useState<string | null>(null) // category name
  const [shelfSelectedIds, setShelfSelectedIds] = useState<Set<string>>(new Set())
  // Per-shelf menu & clear
  const [openShelfMenu, setOpenShelfMenu] = useState<string | null>(null)
  const [clearShelfConfirm, setClearShelfConfirm] = useState<string | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Close shelf menu on outside click
  useEffect(() => {
    if (!openShelfMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const wraps = document.querySelectorAll('.pt-shelf-overflow-wrap')
      if (!Array.from(wraps).some((w) => w.contains(target))) {
        setOpenShelfMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [openShelfMenu])

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    clearTimeout((window as any).__pantrySearchTimer)
    ;(window as any).__pantrySearchTimer = setTimeout(() => {
      setDebouncedSearch(val)
    }, 350)
  }, [])

  // Load all items — no pagination
  const { data: pantryData, isLoading, isError, refetch } = useQuery({
    queryKey: ['pantry', debouncedSearch],
    queryFn: () =>
      pantryApi.getPantryItems({ search: debouncedSearch || undefined, limit: 500 }),
    staleTime: 2 * 60 * 1000,
  })


  // ── Mutations ────────────────────────────

  const addMutation = useMutation({
    mutationFn: (payload: AddPantryItemPayload) => pantryApi.addItem(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      showToast('Item added to pantry!')
      setShowAddModal(false)
    },
    onError: (err: Error) => showToast(err.message || 'Failed to add item', 'error'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePantryItemPayload }) =>
      pantryApi.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      showToast('Item updated!')
      setEditItem(null)
    },
    onError: (err: Error) => showToast(err.message || 'Failed to update', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pantryApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      showToast('Item removed.')
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => pantryApi.deleteItem(id))),
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      setShelfSelectedIds(new Set())
      setShelfSelectMode(null)
      showToast(`${ids.length} item${ids.length > 1 ? 's' : ''} removed.`)
    },
    onError: () => showToast('Failed to delete items', 'error'),
  })

  const clearShelfMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => pantryApi.deleteItem(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      setClearShelfConfirm(null)
      showToast('Shelf cleared.')
    },
    onError: () => showToast('Failed to clear shelf', 'error'),
  })

  // ── Per-shelf selection helpers ──────────

  const toggleShelfSelect = (item: PantryItem) => {
    setShelfSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }

  const exitShelfSelectMode = () => {
    setShelfSelectMode(null)
    setShelfSelectedIds(new Set())
  }

  // ── Grouping ─────────────────────────────

  const items = pantryData?.items ?? []
  const total = pantryData?.pagination?.total ?? items.length

  const grouped = new Map<string, PantryItem[]>()
  for (const item of items) {
    const cat = inferCategory(item.ingredientName)
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(item)
  }

  const shelves = SHELF_ORDER
    .filter((cat) => grouped.has(cat))
    .map((cat) => ({ cat, items: grouped.get(cat)! }))



  return (
    <div className="pt-root">
      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`pt-toast pt-toast--${toast.type}`}
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
        className="pt-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <p className="pt-eyebrow">Inventory</p>
          <h1 className="pt-title">My Pantry</h1>
        </div>
        <div className="pt-header-actions">
<button className="pt-btn pt-btn--primary" onClick={() => setShowAddModal(true)}>
            <Plus size={15} />
            Add item
          </button>
        </div>
      </motion.header>

      {/* ── Toolbar: search + stats ── */}
      <motion.div
        className="pt-toolbar"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.06 }}
      >
        <div className="pt-search-wrap">
          <Search size={15} className="pt-search-icon" />
          <input
            className="pt-search"
            placeholder="Search pantry items…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {search && (
            <button className="pt-search-clear" onClick={() => handleSearchChange('')}>
              <X size={13} />
            </button>
          )}
        </div>
        {total > 0 && (
          <div className="pt-toolbar-right">
            <span className="pt-item-count">
              <Package size={13} />
              {total} item{total !== 1 ? 's' : ''} · {shelves.length} categor{shelves.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>
        )}
      </motion.div>

      {/* ── Error state ── */}
      {isError && (
        <motion.div
          className="pt-empty"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="pt-empty-icon">
            <AlertTriangle size={40} />
          </div>
          <h2>Failed to load pantry</h2>
          <p>Something went wrong. Please try again.</p>
          <button className="pt-btn pt-btn--primary" onClick={() => refetch()}>
            <RefreshCw size={15} />
            Retry
          </button>
        </motion.div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !isError && items.length === 0 && (
        <motion.div
          className="pt-empty"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="pt-empty-icon">
            <Package size={40} />
          </div>
          <h2>{debouncedSearch ? 'No items match your search' : 'Your pantry is empty'}</h2>
          <p>
            {debouncedSearch
              ? 'Try a different search term.'
              : 'Start tracking ingredients you have at home to get personalised recipe suggestions.'}
          </p>
          {!debouncedSearch && (
            <button className="pt-btn pt-btn--primary" onClick={() => setShowAddModal(true)}>
              <Plus size={15} />
              Add first item
            </button>
          )}
        </motion.div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="pt-shelves-loading">
          {[1, 2, 3].map((i) => (
            <div key={i} className="pt-shelf-skeleton" style={{ height: i === 2 ? 90 : 110 }} />
          ))}
        </div>
      )}

      {/* ── Shelves ── */}
      {!isLoading && shelves.length > 0 && (
        <div className="pt-shelves">
          {shelves.map(({ cat, items: shelfItems }, idx) => {
            const meta = SHELF_META[cat] ?? SHELF_META['Other']
            return (
              <motion.div
                key={cat}
                className="pt-shelf"
                style={{
                  '--shelf-bg':     meta.bg,
                  '--shelf-border': meta.border,
                  '--shelf-board':  meta.board,
                  '--chip-bg':      meta.chipBg,
                } as React.CSSProperties}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: idx * 0.055 }}
              >
                {/* Shelf label + mini-menu */}
                <div className="pt-shelf-header">
                  <span className="pt-shelf-emoji" aria-hidden>{meta.emoji}</span>
                  <span className="pt-shelf-name">{cat}</span>
                  <span className="pt-shelf-count">{shelfItems.length}</span>
                  {shelfSelectMode === cat && (
                    <button className="pt-shelf-cancel-btn" onClick={exitShelfSelectMode}>
                      <X size={12} /> Cancel
                    </button>
                  )}
                  <div className="pt-shelf-overflow-wrap">
                    <button
                      className="pt-shelf-menu-btn"
                      onClick={() => setOpenShelfMenu(openShelfMenu === cat ? null : cat)}
                      title="Shelf options"
                      aria-label="Shelf options"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    <AnimatePresence>
                      {openShelfMenu === cat && (
                        <motion.div
                          className="pt-shelf-menu"
                          initial={{ opacity: 0, y: -4, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.96 }}
                          transition={{ duration: 0.13 }}
                        >
                          <button
                            className="pt-overflow-item"
                            onClick={() => { setShowAddModal(true); setOpenShelfMenu(null) }}
                          >
                            <Plus size={13} />
                            Add item
                          </button>
                          <button
                            className="pt-overflow-item"
                            onClick={() => {
                              setShelfSelectMode(cat)
                              setShelfSelectedIds(new Set())
                              setOpenShelfMenu(null)
                            }}
                          >
                            <CheckSquare size={13} />
                            Select &amp; delete
                          </button>
                          <div className="pt-overflow-divider" />
                          <button
                            className="pt-overflow-item pt-overflow-item--danger"
                            onClick={() => { setClearShelfConfirm(cat); setOpenShelfMenu(null) }}
                          >
                            <Trash2 size={13} />
                            Clear shelf
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Items */}
                <div className="pt-shelf-chips">
                  <AnimatePresence mode="popLayout">
                    {shelfItems.map((item) => {
                      const inSelectMode = shelfSelectMode === cat
                      const isSelected = inSelectMode && shelfSelectedIds.has(item.id)
                      return (
                        <motion.button
                          key={item.id}
                          className={`pt-chip${isSelected ? ' pt-chip--selected' : ''}${inSelectMode ? ' pt-chip--selectable' : ''}`}
                          layout
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.82, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.2 }}
                          onClick={() => {
                            if (inSelectMode) toggleShelfSelect(item)
                            else setEditItem(item)
                          }}
                          title={inSelectMode ? undefined : 'Click to edit'}
                        >
                          {isSelected && (
                            <span className="pt-chip-check">
                              <Check size={9} strokeWidth={3} />
                            </span>
                          )}
                          <span className="pt-chip-name">{item.ingredientName}</span>
                          {(item.quantity != null || item.unit) && (
                            <span className="pt-chip-qty">
                              {item.quantity != null ? item.quantity : ''}
                              {item.unit ? ` ${item.unit}` : ''}
                            </span>
                          )}
                          {!inSelectMode && (
                            <span className="pt-chip-edit-icon" aria-hidden>
                              <Edit2 size={9} />
                            </span>
                          )}
                        </motion.button>
                      )
                    })}
                  </AnimatePresence>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── Floating action bar (shelf select mode) ── */}
      <AnimatePresence>
        {shelfSelectMode && shelfSelectedIds.size > 0 && (
          <motion.div
            className="pt-action-bar"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <span className="pt-action-bar-count">
              {shelfSelectedIds.size} selected
            </span>
            <button
              className="pt-btn pt-btn--danger"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate(Array.from(shelfSelectedIds))}
            >
              {bulkDeleteMutation.isPending
                ? <RefreshCw size={14} className="pt-spin" />
                : <Trash2 size={14} />
              }
              Delete {shelfSelectedIds.size} item{shelfSelectedIds.size > 1 ? 's' : ''}
            </button>
            <button className="pt-action-bar-cancel" onClick={exitShelfSelectMode}>
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add modal ── */}
      <AnimatePresence>
        {showAddModal && (
          <PantryItemModal
            title="Add pantry item"
            isLoading={addMutation.isPending}
            onClose={() => setShowAddModal(false)}
            onSubmit={(payload) => addMutation.mutate(payload)}
            units={UNITS}
          />
        )}
      </AnimatePresence>

      {/* ── Edit modal ── */}
      <AnimatePresence>
        {editItem && (
          <PantryItemModal
            title="Edit item"
            initialValues={editItem}
            isLoading={updateMutation.isPending}
            onClose={() => setEditItem(null)}
            onSubmit={(payload) => updateMutation.mutate({ id: editItem.id, data: payload })}
            onDelete={() => {
              deleteMutation.mutate(editItem.id)
              setEditItem(null)
            }}
            units={UNITS}
          />
        )}
      </AnimatePresence>

      {/* ── Clear shelf confirm modal ── */}
      <AnimatePresence>
        {clearShelfConfirm && (
          <ClearConfirmModal
            shelfName={clearShelfConfirm}
            isLoading={clearShelfMutation.isPending}
            onClose={() => setClearShelfConfirm(null)}
            onConfirm={() => {
              const ids = (grouped.get(clearShelfConfirm) ?? []).map((i) => i.id)
              clearShelfMutation.mutate(ids)
            }}
          />
        )}
      </AnimatePresence>

    </div>
  )
}

// ── Clear shelf confirm modal ────────────

function ClearConfirmModal({
  shelfName,
  isLoading,
  onClose,
  onConfirm,
}: {
  shelfName: string
  isLoading: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="pt-overlay" onClick={onClose}>
      <motion.div
        className="pt-modal pt-modal--sm"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
      >
        <div className="pt-modal-header">
          <h2>Clear {shelfName}?</h2>
          <button className="pt-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pt-clear-modal-body">
          <p>All items in the <strong>{shelfName}</strong> shelf will be removed. This cannot be undone.</p>
        </div>
        <div className="pt-modal-actions">
          <button className="pt-btn pt-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="pt-btn pt-btn--danger"
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? <RefreshCw size={14} className="pt-spin" /> : <Trash2 size={14} />}
            Clear shelf
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Pantry item modal ────────────────────

function PantryItemModal({
  title,
  initialValues,
  isLoading,
  onClose,
  onSubmit,
  onDelete,
  units,
}: {
  title: string
  initialValues?: PantryItem
  isLoading: boolean
  onClose: () => void
  onSubmit: (payload: AddPantryItemPayload) => void
  onDelete?: () => void
  units: string[]
}) {
  const isAddMode = !initialValues
  const [form, setForm] = useState<AddPantryItemPayload>({
    ingredientName: initialValues?.ingredientName ?? '',
    quantity: initialValues?.quantity ?? undefined,
    unit: initialValues?.unit ?? '',
  })
  const [similarItems, setSimilarItems] = useState<PantryItem[]>([])
  const [checkingName, setCheckingName] = useState(false)

  const checkSimilar = async (name: string) => {
    if (!isAddMode || !name.trim() || name.trim().length < 3) {
      setSimilarItems([])
      return
    }
    setCheckingName(true)
    try {
      const results = await pantryApi.checkSimilar(name.trim())
      setSimilarItems(results)
    } catch {
      // non-critical
    } finally {
      setCheckingName(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ingredientName.trim()) return
    onSubmit({
      ingredientName: form.ingredientName.trim(),
      quantity: form.quantity || undefined,
      unit: form.unit || undefined,
    })
  }

  return (
    <div className="pt-overlay" onClick={onClose}>
      <motion.div
        className="pt-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
      >
        <div className="pt-modal-header">
          <h2>{title}</h2>
          <button className="pt-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="pt-modal-form">
          <label className="pt-label">
            Ingredient name *
            <input
              className="pt-input"
              placeholder="e.g. Olive oil"
              value={form.ingredientName}
              onChange={(e) => setForm((f) => ({ ...f, ingredientName: e.target.value }))}
              onBlur={(e) => checkSimilar(e.target.value)}
              autoFocus
            />
          </label>

          <AnimatePresence>
            {isAddMode && similarItems.length > 0 && !checkingName && (
              <motion.div
                className="pt-similar-warning"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <AlertTriangle size={14} className="pt-similar-icon" />
                <div className="pt-similar-content">
                  <p className="pt-similar-title">
                    Similar item{similarItems.length > 1 ? 's' : ''} already in pantry:
                  </p>
                  {similarItems.map((s) => (
                    <div key={s.id} className="pt-similar-item">
                      {s.ingredientName}
                      {s.quantity != null ? ` (${s.quantity}${s.unit ? ` ${s.unit}` : ''})` : ''}
                    </div>
                  ))}
                  <p className="pt-similar-note">
                    You can still add separately, or close and use Merge to combine.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-row">
            <label className="pt-label pt-label--half">
              Quantity
              <input
                className="pt-input"
                type="number"
                min="0"
                step="any"
                placeholder="Amount"
                value={form.quantity ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    quantity: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
              />
            </label>
            <label className="pt-label pt-label--half">
              Unit
              <select
                className="pt-input"
                value={form.unit ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              >
                <option value="">None</option>
                {units.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="pt-modal-actions">
            {onDelete && (
              <button
                type="button"
                className="pt-btn pt-btn--danger"
                style={{ marginRight: 'auto' }}
                onClick={onDelete}
              >
                <Trash2 size={14} />
                Delete
              </button>
            )}
            <button type="button" className="pt-btn pt-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="pt-btn pt-btn--primary"
              disabled={isLoading || !form.ingredientName.trim()}
            >
              {isLoading ? <RefreshCw size={14} className="pt-spin" /> : <Check size={14} />}
              {isAddMode ? 'Add item' : 'Save changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
