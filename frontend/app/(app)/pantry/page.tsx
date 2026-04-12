'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'
import {
  Package, Plus, Trash2, Search, Sparkles, RefreshCw,
  X, Check, Edit2, GitMerge, AlertTriangle, CheckSquare,
} from 'lucide-react'
import {
  pantryApi,
  PantryItem,
  AddPantryItemPayload,
  UpdatePantryItemPayload,
} from '@/services/pantry.service'
import { aiApi, AIPantrySuggestions } from '@/services/ai.service'
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

type SelectMode = 'delete' | 'merge' | null

export default function PantryPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState<PantryItem | null>(null)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [selectMode, setSelectMode] = useState<SelectMode>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mergeConfirm, setMergeConfirm] = useState<{ a: PantryItem; b: PantryItem } | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    clearTimeout((window as any).__pantrySearchTimer)
    ;(window as any).__pantrySearchTimer = setTimeout(() => {
      setDebouncedSearch(val)
    }, 350)
  }, [])

  // Load all items — no pagination
  const { data: pantryData, isLoading } = useQuery({
    queryKey: ['pantry', debouncedSearch],
    queryFn: () =>
      pantryApi.getPantryItems({ search: debouncedSearch || undefined, limit: 500 }),
  })

  const { data: aiData, mutate: fetchSuggestions, isPending: suggestionsLoading } =
    useMutation<AIPantrySuggestions>({
      mutationFn: () => aiApi.getPantrySuggestions(),
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
      setSelectedIds(new Set())
      setSelectMode(null)
      showToast(`${ids.length} item${ids.length > 1 ? 's' : ''} removed.`)
    },
    onError: () => showToast('Failed to delete items', 'error'),
  })

  const clearMutation = useMutation({
    mutationFn: () => pantryApi.clearPantry(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      setShowClearConfirm(false)
      showToast('Pantry cleared.')
    },
  })

  const mergeMutation = useMutation({
    mutationFn: ({ keepId, mergeId }: { keepId: string; mergeId: string }) =>
      pantryApi.mergeItems(keepId, mergeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      setMergeConfirm(null)
      setSelectedIds(new Set())
      setSelectMode(null)
      showToast('Items merged!')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to merge', 'error'),
  })

  // ── Selection helpers ────────────────────

  const toggleSelect = (item: PantryItem) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) {
        next.delete(item.id)
      } else {
        if (selectMode === 'merge' && next.size >= 2) return prev
        next.add(item.id)
      }
      return next
    })
  }

  const exitSelectMode = () => {
    setSelectMode(null)
    setSelectedIds(new Set())
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

  const selectedItems = items.filter((i) => selectedIds.has(i.id))

  const handleAiClick = () => {
    setShowAiPanel(true)
    if (!aiData) fetchSuggestions()
  }

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
          <button className="pt-btn pt-btn--ghost" onClick={handleAiClick}>
            <Sparkles size={15} />
            AI suggestions
          </button>
          {selectMode === null ? (
            <>
              <button className="pt-btn pt-btn--ghost" onClick={() => setSelectMode('merge')}>
                <GitMerge size={15} />
                Merge
              </button>
              <button className="pt-btn pt-btn--ghost" onClick={() => setSelectMode('delete')}>
                <CheckSquare size={15} />
                Select
              </button>
              <button
                className="pt-btn pt-btn--primary"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={15} />
                Add item
              </button>
            </>
          ) : (
            <button className="pt-btn pt-btn--ghost" onClick={exitSelectMode}>
              <X size={15} />
              Cancel
            </button>
          )}
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
            <button className="pt-clear-btn" onClick={() => setShowClearConfirm(true)}>
              <Trash2 size={12} />
              Clear all
            </button>
          </div>
        )}
      </motion.div>

      {/* ── Mode banner ── */}
      <AnimatePresence>
        {selectMode && (
          <motion.div
            className={`pt-mode-banner pt-mode-banner--${selectMode}`}
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            transition={{ duration: 0.2 }}
          >
            {selectMode === 'delete' ? (
              <>
                <CheckSquare size={14} />
                Tap items to select them — then delete all at once
              </>
            ) : (
              <>
                <GitMerge size={14} />
                Select exactly 2 items to merge into one
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ── */}
      {!isLoading && items.length === 0 && (
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
                {/* Shelf label */}
                <div className="pt-shelf-header">
                  <span className="pt-shelf-emoji" aria-hidden>{meta.emoji}</span>
                  <span className="pt-shelf-name">{cat}</span>
                  <span className="pt-shelf-count">{shelfItems.length}</span>
                </div>

                {/* Items */}
                <div className="pt-shelf-chips">
                  <AnimatePresence mode="popLayout">
                    {shelfItems.map((item) => {
                      const isSelected = selectedIds.has(item.id)
                      const isDisabled =
                        selectMode === 'merge' && selectedIds.size >= 2 && !isSelected
                      return (
                        <motion.button
                          key={item.id}
                          className={`pt-chip${isSelected ? ' pt-chip--selected' : ''}${isDisabled ? ' pt-chip--disabled' : ''}${selectMode ? ' pt-chip--selectable' : ''}`}
                          layout
                          initial={{ opacity: 0, scale: 0.88 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.82, transition: { duration: 0.15 } }}
                          transition={{ duration: 0.2 }}
                          onClick={() => {
                            if (selectMode) {
                              if (!isDisabled) toggleSelect(item)
                            } else {
                              setEditItem(item)
                            }
                          }}
                          title={selectMode ? undefined : 'Click to edit'}
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
                          {!selectMode && (
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

      {/* ── Floating action bar ── */}
      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            className="pt-action-bar"
            initial={{ opacity: 0, y: 32, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 32, scale: 0.96 }}
            transition={{ duration: 0.22, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <span className="pt-action-bar-count">
              {selectedIds.size} selected
            </span>
            {selectMode === 'delete' && (
              <button
                className="pt-btn pt-btn--danger"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
              >
                {bulkDeleteMutation.isPending
                  ? <RefreshCw size={14} className="pt-spin" />
                  : <Trash2 size={14} />
                }
                Delete {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}
              </button>
            )}
            {selectMode === 'merge' && selectedIds.size === 2 && (
              <button
                className="pt-btn pt-btn--primary"
                onClick={() =>
                  setMergeConfirm({ a: selectedItems[0], b: selectedItems[1] })
                }
              >
                <GitMerge size={14} />
                Merge items
              </button>
            )}
            <button className="pt-action-bar-cancel" onClick={exitSelectMode}>
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

      {/* ── Merge confirm modal ── */}
      <AnimatePresence>
        {mergeConfirm && (
          <MergeConfirmModal
            a={mergeConfirm.a}
            b={mergeConfirm.b}
            isLoading={mergeMutation.isPending}
            onClose={() => setMergeConfirm(null)}
            onConfirm={(keepId, mergeId) => mergeMutation.mutate({ keepId, mergeId })}
          />
        )}
      </AnimatePresence>

      {/* ── Clear confirm modal ── */}
      <AnimatePresence>
        {showClearConfirm && (
          <ClearConfirmModal
            isLoading={clearMutation.isPending}
            onClose={() => setShowClearConfirm(false)}
            onConfirm={() => clearMutation.mutate()}
          />
        )}
      </AnimatePresence>

      {/* ── AI suggestions panel ── */}
      <AnimatePresence>
        {showAiPanel && (
          <AiSuggestionsPanel
            data={aiData ?? null}
            isLoading={suggestionsLoading}
            onRefresh={() => fetchSuggestions()}
            onClose={() => setShowAiPanel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Clear confirm modal ──────────────────

function ClearConfirmModal({
  isLoading,
  onClose,
  onConfirm,
}: {
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
          <h2>Clear pantry?</h2>
          <button className="pt-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pt-clear-modal-body">
          <p>This will remove all items from your pantry. This cannot be undone.</p>
        </div>
        <div className="pt-modal-actions">
          <button className="pt-btn pt-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="pt-btn pt-btn--danger"
            disabled={isLoading}
            onClick={onConfirm}
          >
            {isLoading ? <RefreshCw size={14} className="pt-spin" /> : <Trash2 size={14} />}
            Yes, clear all
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Merge confirm modal ──────────────────

function MergeConfirmModal({
  a, b, isLoading, onClose, onConfirm,
}: {
  a: PantryItem
  b: PantryItem
  isLoading: boolean
  onClose: () => void
  onConfirm: (keepId: string, mergeId: string) => void
}) {
  const [keepId, setKeepId] = useState(a.id)
  const mergeId = keepId === a.id ? b.id : a.id
  const keepItem = keepId === a.id ? a : b
  const mergeItem = keepId === a.id ? b : a
  const totalQty =
    a.quantity !== null && b.quantity !== null
      ? a.quantity + b.quantity
      : a.quantity ?? b.quantity

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
          <h2>Merge items</h2>
          <button className="pt-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="pt-merge-modal-body">
          <p className="pt-merge-hint">Choose which name to keep. Quantities will be combined.</p>
          <div className="pt-merge-options">
            {[a, b].map((item) => (
              <button
                key={item.id}
                className={`pt-merge-option${keepId === item.id ? ' selected' : ''}`}
                onClick={() => setKeepId(item.id)}
              >
                <div className={`pt-merge-radio${keepId === item.id ? ' checked' : ''}`}>
                  {keepId === item.id && <Check size={10} />}
                </div>
                <div>
                  <div className="pt-merge-option-name">{item.ingredientName}</div>
                  {item.quantity != null && (
                    <div className="pt-merge-option-qty">
                      {item.quantity}{item.unit ? ` ${item.unit}` : ''}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="pt-merge-preview">
            Result: <strong>{keepItem.ingredientName}</strong>
            {totalQty !== null && (
              <> — {totalQty}{keepItem.unit ? ` ${keepItem.unit}` : ''}</>
            )}
            <span className="pt-merge-preview-drop"> (removes "{mergeItem.ingredientName}")</span>
          </div>
        </div>
        <div className="pt-modal-actions">
          <button className="pt-btn pt-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            className="pt-btn pt-btn--primary"
            disabled={isLoading}
            onClick={() => onConfirm(keepId, mergeId)}
          >
            {isLoading ? <RefreshCw size={14} className="pt-spin" /> : <GitMerge size={14} />}
            Confirm merge
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

// ── AI suggestions panel ─────────────────

function AiSuggestionsPanel({
  data,
  isLoading,
  onRefresh,
  onClose,
}: {
  data: AIPantrySuggestions | null
  isLoading: boolean
  onRefresh: () => void
  onClose: () => void
}) {
  return (
    <div className="pt-overlay" onClick={onClose}>
      <motion.div
        className="pt-modal pt-modal--ai"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.25 }}
      >
        <div className="pt-ai-header">
          <div className="pt-ai-header-left">
            <div className="pt-ai-icon"><Sparkles size={18} /></div>
            <div>
              <h2>AI Pantry Suggestions</h2>
              <p>Based on what you have at home</p>
            </div>
          </div>
          <div className="pt-ai-actions">
            <button className="pt-modal-close" onClick={onRefresh} title="Refresh">
              <RefreshCw size={16} className={isLoading ? 'pt-spin' : ''} />
            </button>
            <button className="pt-modal-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="pt-ai-body">
          {isLoading && (
            <div className="pt-ai-loading">
              <div className="pt-ai-dots">
                <span /><span /><span />
              </div>
              <p>Analysing your pantry…</p>
            </div>
          )}
          {!isLoading && !data && (
            <div className="pt-ai-empty">
              <p>Click refresh to get recipe suggestions based on your pantry.</p>
            </div>
          )}
          {!isLoading && data && (
            <>
              {/* Pantry health score */}
              <div className="pt-ai-score">
                <span className="pt-ai-score-label">Pantry health score</span>
                <div className="pt-ai-score-bar">
                  <div
                    className="pt-ai-score-fill"
                    style={{ width: `${data.pantryHealthScore}%` }}
                  />
                </div>
                <span className="pt-ai-score-num">{data.pantryHealthScore}/100</span>
              </div>

              {/* Missing essentials */}
              {data.missingEssentials.length > 0 && (
                <div className="pt-ai-missing">
                  <span className="pt-ai-missing-label">Missing essentials:</span>
                  <span className="pt-ai-missing-items">{data.missingEssentials.join(', ')}</span>
                </div>
              )}

              {/* Recipe suggestions */}
              <ul className="pt-ai-list">
                {data.suggestions.map((s, i) => (
                  <motion.li
                    key={i}
                    className="pt-ai-item pt-ai-item--recipe"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className="pt-ai-recipe-header">
                      <span className="pt-ai-num">{i + 1}</span>
                      <div className="pt-ai-recipe-title-wrap">
                        <span className="pt-ai-recipe-title">{s.title}</span>
                        <span className={`pt-ai-difficulty pt-ai-difficulty--${s.difficulty.toLowerCase()}`}>
                          {s.difficulty}
                        </span>
                      </div>
                      <span className="pt-ai-recipe-time">
                        {s.prepTimeMinutes + s.cookTimeMinutes} min
                      </span>
                    </div>
                    <p className="pt-ai-recipe-desc">{s.description}</p>
                    <div className="pt-ai-ingredients">
                      {s.usedIngredients.length > 0 && (
                        <div className="pt-ai-ing-group">
                          <span className="pt-ai-ing-label pt-ai-ing-label--have">✓ Have</span>
                          <span className="pt-ai-ing-list">{s.usedIngredients.join(', ')}</span>
                        </div>
                      )}
                      {s.missingIngredients.length > 0 && (
                        <div className="pt-ai-ing-group">
                          <span className="pt-ai-ing-label pt-ai-ing-label--need">+ Need</span>
                          <span className="pt-ai-ing-list">{s.missingIngredients.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </motion.li>
                ))}
              </ul>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )
}
