'use client'

import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Apple, Sparkles, Loader2, Clock, Flame,
  ChevronDown, ChevronUp, ShoppingCart, CheckCircle2, CalendarPlus,
} from 'lucide-react'
import { pantryApi, PantryRecipeSuggestion } from '@/services/pantry.service'
import { aiApi } from '@/services/ai.service'
import AddToPlanModal from '@/components/AddToPlanModal'

const DIFFICULTY_COLOR = {
  Easy:   { bg: 'var(--teal-50)',   color: 'var(--teal-600)' },
  Medium: { bg: 'var(--amber-50)',  color: 'var(--amber-600)' },
  Hard:   { bg: 'var(--coral-50)',  color: 'var(--coral-600)' },
}

function SuggestionCard({
  s,
  onAddToPlan,
  isSaving,
}: {
  s: PantryRecipeSuggestion
  onAddToPlan: () => void
  isSaving: boolean
}) {
  const [open, setOpen] = useState(false)
  const totalMins = s.prepTimeMinutes + s.cookTimeMinutes
  const diff = DIFFICULTY_COLOR[s.difficulty] ?? DIFFICULTY_COLOR.Medium

  return (
    <div className="psc-card">
      <div className="psc-card-header" onClick={() => setOpen((v) => !v)}>
        <div className="psc-card-main">
          <h3 className="psc-card-title">{s.title}</h3>
          <p className="psc-card-desc">{s.description}</p>
          <div className="psc-card-meta">
            {totalMins > 0 && (
              <span className="psc-meta-item"><Clock size={12} />{totalMins}m</span>
            )}
            {s.estimatedCalories > 0 && (
              <span className="psc-meta-item"><Flame size={12} />{s.estimatedCalories} kcal</span>
            )}
            <span className="psc-difficulty" style={{ background: diff.bg, color: diff.color }}>
              {s.difficulty}
            </span>
          </div>
          <div className="psc-ingredients-row">
            <div className="psc-ing-group">
              <span className="psc-ing-label psc-ing-label--have">
                <CheckCircle2 size={11} /> Have ({s.usedIngredients.length})
              </span>
              <p className="psc-ing-list">{s.usedIngredients.join(', ')}</p>
            </div>
            {s.missingIngredients.length > 0 && (
              <div className="psc-ing-group">
                <span className="psc-ing-label psc-ing-label--need">
                  <ShoppingCart size={11} /> Need ({s.missingIngredients.length})
                </span>
                <p className="psc-ing-list psc-ing-list--need">{s.missingIngredients.join(', ')}</p>
              </div>
            )}
          </div>
        </div>
        <button className="psc-expand-btn">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="psc-steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <ol className="psc-steps-list">
              {s.steps.map((step, i) => (
                <li key={i} className="psc-step">
                  <span className="psc-step-num">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add to Plan footer */}
      <div className="psc-card-footer" onClick={(e) => e.stopPropagation()}>
        <button
          className="psc-add-plan-btn"
          onClick={onAddToPlan}
          disabled={isSaving}
        >
          {isSaving
            ? <Loader2 size={13} className="psc-spin" />
            : <CalendarPlus size={13} />
          }
          {isSaving ? 'Saving…' : 'Add to Meal Plan'}
        </button>
      </div>
    </div>
  )
}

export default function PantrySuggestionsModal({ onClose }: { onClose: () => void }) {
  const { mutate: fetch, isPending, data, error } = useMutation({
    mutationFn: () => pantryApi.getSuggestions(),
  })

  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [planModal, setPlanModal] = useState<{ recipeId: string; recipeTitle: string } | null>(null)

  const { mutate: saveRecipe } = useMutation({
    mutationFn: (suggestion: PantryRecipeSuggestion) => aiApi.savePantryRecipe(suggestion),
    onSuccess: (result) => {
      setSavingIndex(null)
      setPlanModal({ recipeId: result.id, recipeTitle: result.title })
    },
    onError: () => {
      setSavingIndex(null)
    },
  })

  const handleAddToPlan = (suggestion: PantryRecipeSuggestion, index: number) => {
    setSavingIndex(index)
    saveRecipe(suggestion)
  }

  // Auto-fetch on mount
  useEffect(() => { fetch() }, [])

  const score = data?.pantryHealthScore ?? 0
  const scoreColor = score >= 70 ? 'var(--teal-400)' : score >= 40 ? 'var(--amber-400)' : 'var(--coral-400)'

  return (
    <>
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <motion.div
          className="psc-modal"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.22 }}
        >
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title">
              <div className="ai-icon" style={{ background: 'linear-gradient(135deg, var(--amber-50), var(--teal-50))', color: 'var(--teal-600)' }}>
                <Apple size={16} />
              </div>
              <div>
                <h2>What can I cook?</h2>
                <p className="psc-modal-sub">AI suggestions from your pantry</p>
              </div>
            </div>
            <button className="modal-close" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Body */}
          <div className="psc-body">
            {isPending && (
              <div className="psc-loading">
                <div className="ai-pulse">
                  <Sparkles size={20} />
                </div>
                <p>Checking your pantry and finding the best recipes…</p>
              </div>
            )}

            {error && (
              <div className="psc-error">
                <p>Something went wrong. Make sure you have items in your pantry.</p>
                <button className="modal-generate-btn" onClick={() => fetch()}>
                  <Sparkles size={14} /> Try again
                </button>
              </div>
            )}

            {data && !isPending && (
              <>
                {/* Pantry health score */}
                <div className="psc-score-bar">
                  <div className="psc-score-label">
                    <span>Pantry health score</span>
                    <span style={{ color: scoreColor, fontWeight: 600 }}>{score}/100</span>
                  </div>
                  <div className="psc-score-track">
                    <motion.div
                      className="psc-score-fill"
                      style={{ background: scoreColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${score}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' as const }}
                    />
                  </div>
                  {data.missingEssentials.length > 0 && (
                    <p className="psc-missing-essentials">
                      Missing staples: {data.missingEssentials.join(', ')}
                    </p>
                  )}
                </div>

                {/* Suggestions */}
                <div className="psc-suggestions">
                  {data.suggestions.map((s, i) => (
                    <SuggestionCard
                      key={i}
                      s={s}
                      isSaving={savingIndex === i}
                      onAddToPlan={() => handleAddToPlan(s, i)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {data && !isPending && (
            <div className="modal-footer">
              <button className="modal-cancel-btn" onClick={onClose}>Close</button>
              <button className="modal-generate-btn" onClick={() => fetch()}>
                <Sparkles size={14} /> Regenerate
              </button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Add to Plan modal — rendered outside psc-modal so it layers correctly */}
      <AnimatePresence>
        {planModal && (
          <AddToPlanModal
            recipeId={planModal.recipeId}
            recipeTitle={planModal.recipeTitle}
            onClose={() => setPlanModal(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
