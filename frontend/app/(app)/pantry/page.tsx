'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useCallback } from 'react'
import {
  Package, Plus, Trash2, Search, Sparkles, RefreshCw,
  X, Check, Edit2, ChevronLeft, ChevronRight, GitMerge, AlertTriangle,
} from 'lucide-react'
import {
  pantryApi,
  PantryItem,
  AddPantryItemPayload,
  UpdatePantryItemPayload,
} from '@/services/pantry.service'
import { aiApi } from '@/services/ai.service'
import './pantry.css'

// ── Animation variants ───────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.18 } },
}

const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'cups', 'tbsp', 'tsp', 'oz', 'lb']

export default function PantryPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editItem, setEditItem] = useState<PantryItem | null>(null)
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  // Merge mode
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<PantryItem[]>([])
  const [mergeConfirm, setMergeConfirm] = useState<{ a: PantryItem; b: PantryItem } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Debounce search
  const handleSearchChange = useCallback((val: string) => {
    setSearch(val)
    clearTimeout((window as any).__pantrySearchTimer)
    ;(window as any).__pantrySearchTimer = setTimeout(() => {
      setDebouncedSearch(val)
      setPage(1)
    }, 350)
  }, [])

  // ── Queries ──────────────────────────────

  const { data: pantryData, isLoading } = useQuery({
    queryKey: ['pantry', debouncedSearch, page],
    queryFn: () => pantryApi.getPantryItems({ search: debouncedSearch || undefined, page, limit: 24 }),
  })

  const { data: suggestions, mutate: fetchSuggestions, isPending: suggestionsLoading } = useMutation({
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
    onError: (err: Error) => showToast(err.message || 'Failed to update item', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pantryApi.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      showToast('Item removed.')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to delete item', 'error'),
  })

  const clearMutation = useMutation({
    mutationFn: () => pantryApi.clearPantry(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      showToast('Pantry cleared.')
    },
  })

  const mergeMutation = useMutation({
    mutationFn: ({ keepId, mergeId }: { keepId: string; mergeId: string }) =>
      pantryApi.mergeItems(keepId, mergeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      setMergeConfirm(null)
      setSelectedForMerge([])
      setMergeMode(false)
      showToast('Items merged!')
    },
    onError: (err: Error) => showToast(err.message || 'Failed to merge items', 'error'),
  })

  const toggleMergeSelect = (item: PantryItem) => {
    setSelectedForMerge((prev) => {
      const already = prev.find((i) => i.id === item.id)
      if (already) return prev.filter((i) => i.id !== item.id)
      if (prev.length >= 2) return prev // max 2
      return [...prev, item]
    })
  }

  const items = pantryData?.items ?? []
  const pagination = pantryData?.pagination

  const handleAiClick = () => {
    setShowAiPanel(true)
    if (!suggestions) fetchSuggestions()
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
          {mergeMode ? (
            <button
              className="pt-btn pt-btn--ghost"
              onClick={() => { setMergeMode(false); setSelectedForMerge([]) }}
            >
              <X size={15} />
              Cancel merge
            </button>
          ) : (
            <button
              className="pt-btn pt-btn--ghost"
              onClick={() => setMergeMode(true)}
            >
              <GitMerge size={15} />
              Merge duplicates
            </button>
          )}
          <button
            className="pt-btn pt-btn--primary"
            onClick={() => setShowAddModal(true)}
            disabled={mergeMode}
          >
            <Plus size={15} />
            Add item
          </button>
        </div>
      </motion.header>

      {/* ── Search bar ── */}
      <motion.div
        className="pt-search-wrap"
        custom={0} variants={fadeUp}
        initial="hidden" animate="visible"
      >
        <Search size={16} className="pt-search-icon" />
        <input
          className="pt-search"
          placeholder="Search pantry items..."
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
        />
        {search && (
          <button className="pt-search-clear" onClick={() => handleSearchChange('')}>
            <X size={14} />
          </button>
        )}
      </motion.div>

      {/* ── Stats ── */}
      {pagination && (
        <motion.div
          className="pt-stats"
          custom={1} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <div className="pt-stat">
            <Package size={16} />
            <span><strong>{pagination.total}</strong> item{pagination.total !== 1 ? 's' : ''} in pantry</span>
          </div>
          {pagination.total > 0 && (
            <button
              className="pt-clear-btn"
              onClick={() => {
                if (confirm('Clear all pantry items? This cannot be undone.')) {
                  clearMutation.mutate()
                }
              }}
            >
              <Trash2 size={13} />
              Clear all
            </button>
          )}
        </motion.div>
      )}

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
        <div className="pt-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="pt-skeleton" />
          ))}
        </div>
      )}

      {/* ── Items grid ── */}
      {!isLoading && items.length > 0 && (
        <motion.div
          className="pt-grid"
          custom={2} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <AnimatePresence mode="popLayout">
            {items.map((item) => {
              const isSelected = selectedForMerge.some((i) => i.id === item.id)
              const isDisabled = mergeMode && selectedForMerge.length === 2 && !isSelected
              return (
                <motion.div
                  key={item.id}
                  className={`pt-card${mergeMode ? ' pt-card--merge-mode' : ''}${isSelected ? ' pt-card--selected' : ''}${isDisabled ? ' pt-card--disabled' : ''}`}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  onClick={mergeMode ? () => toggleMergeSelect(item) : undefined}
                  style={{ cursor: mergeMode ? 'pointer' : undefined }}
                >
                  {mergeMode && (
                    <div className={`pt-card-checkbox${isSelected ? ' checked' : ''}`}>
                      {isSelected && <Check size={10} />}
                    </div>
                  )}
                  <div className="pt-card-body">
                    <div className="pt-card-name">{item.ingredientName}</div>
                    {(item.quantity || item.unit) && (
                      <div className="pt-card-qty">
                        {item.quantity != null ? item.quantity : ''}
                        {item.unit ? ` ${item.unit}` : ''}
                      </div>
                    )}
                  </div>
                  {!mergeMode && (
                    <div className="pt-card-actions">
                      <button
                        className="pt-card-btn"
                        onClick={() => setEditItem(item)}
                        aria-label="edit"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="pt-card-btn pt-card-btn--delete"
                        onClick={() => deleteMutation.mutate(item.id)}
                        aria-label="delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Pagination ── */}
      {pagination && pagination.totalPages > 1 && (
        <motion.div
          className="pt-pagination"
          custom={3} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <button
            className="pt-page-btn"
            disabled={!pagination.hasPrev}
            onClick={() => setPage(p => p - 1)}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="pt-page-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="pt-page-btn"
            disabled={!pagination.hasNext}
            onClick={() => setPage(p => p + 1)}
          >
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

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
            units={UNITS}
          />
        )}
      </AnimatePresence>

      {/* ── Floating merge bar ── */}
      <AnimatePresence>
        {mergeMode && (
          <motion.div
            className="pt-merge-bar"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
          >
            <span className="pt-merge-bar-hint">
              {selectedForMerge.length === 0 && 'Select 2 items to merge'}
              {selectedForMerge.length === 1 && 'Select 1 more item'}
              {selectedForMerge.length === 2 && (
                <><strong>{selectedForMerge[0].ingredientName}</strong> + <strong>{selectedForMerge[1].ingredientName}</strong></>
              )}
            </span>
            <button
              className="pt-btn pt-btn--primary"
              disabled={selectedForMerge.length !== 2}
              onClick={() => setMergeConfirm({ a: selectedForMerge[0], b: selectedForMerge[1] })}
            >
              <GitMerge size={14} />
              Merge
            </button>
          </motion.div>
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

      {/* ── AI suggestions panel ── */}
      <AnimatePresence>
        {showAiPanel && (
          <AiSuggestionsPanel
            suggestions={suggestions?.suggestions ?? null}
            isLoading={suggestionsLoading}
            onRefresh={() => fetchSuggestions()}
            onClose={() => setShowAiPanel(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Merge confirm modal ──────────────────

function MergeConfirmModal({
  a,
  b,
  isLoading,
  onClose,
  onConfirm,
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
                    <div className="pt-merge-option-qty">{item.quantity}{item.unit ? ` ${item.unit}` : ''}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="pt-merge-preview">
            Result: <strong>{keepItem.ingredientName}</strong>
            {totalQty !== null && <> — {totalQty}{keepItem.unit ? ` ${keepItem.unit}` : ''}</>}
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
  units,
}: {
  title: string
  initialValues?: PantryItem
  isLoading: boolean
  onClose: () => void
  onSubmit: (payload: AddPantryItemPayload) => void
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
      // silently ignore — the warning is non-critical
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
        onClick={e => e.stopPropagation()}
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
              onChange={e => setForm(f => ({ ...f, ingredientName: e.target.value }))}
              onBlur={e => checkSimilar(e.target.value)}
              autoFocus
            />
          </label>

          {/* Similar items warning */}
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
                  <p className="pt-similar-title">Similar item{similarItems.length > 1 ? 's' : ''} already in pantry:</p>
                  {similarItems.map((s) => (
                    <div key={s.id} className="pt-similar-item">
                      <span>{s.ingredientName}{s.quantity != null ? ` (${s.quantity}${s.unit ? ` ${s.unit}` : ''})` : ''}</span>
                    </div>
                  ))}
                  <p className="pt-similar-note">You can still add separately, or close and use Merge duplicates to combine.</p>
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
                onChange={e => setForm(f => ({
                  ...f,
                  quantity: e.target.value ? Number(e.target.value) : undefined
                }))}
              />
            </label>
            <label className="pt-label pt-label--half">
              Unit
              <select
                className="pt-input"
                value={form.unit ?? ''}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              >
                <option value="">None</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          </div>
          <div className="pt-modal-actions">
            <button type="button" className="pt-btn pt-btn--ghost" onClick={onClose}>Cancel</button>
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
  suggestions,
  isLoading,
  onRefresh,
  onClose,
}: {
  suggestions: string[] | null
  isLoading: boolean
  onRefresh: () => void
  onClose: () => void
}) {
  return (
    <div className="pt-overlay" onClick={onClose}>
      <motion.div
        className="pt-modal pt-modal--ai"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 40 }}
        transition={{ duration: 0.25 }}
      >
        <div className="pt-ai-header">
          <div className="pt-ai-header-left">
            <div className="pt-ai-icon">
              <Sparkles size={18} />
            </div>
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
              <p>Analysing your pantry...</p>
            </div>
          )}

          {!isLoading && !suggestions && (
            <div className="pt-ai-empty">
              <p>No suggestions yet. Make sure you have items in your pantry!</p>
            </div>
          )}

          {!isLoading && suggestions && (
            <ul className="pt-ai-list">
              {suggestions.map((s, i) => (
                <motion.li
                  key={i}
                  className="pt-ai-item"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <span className="pt-ai-num">{i + 1}</span>
                  <span>{s}</span>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  )
}
