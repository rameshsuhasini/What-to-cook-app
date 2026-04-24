'use client'

import './recipes.css'
import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Sparkles, X, Heart, Clock, Flame, Loader2,
  ChefHat, UtensilsCrossed, Users, Refrigerator, CalendarPlus, Link,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { recipeApi, Recipe, DietType, MealType } from '@/services/recipe.service'
import PantrySuggestionsModal from '@/components/PantrySuggestionsModal'
import AddToPlanModal from '@/components/AddToPlanModal'

// ── Constants ─────────────────────────────────────────────

const DIET_OPTIONS: { value: DietType | ''; label: string }[] = [
  { value: '',             label: 'All diets' },
  { value: 'NONE',        label: 'No restriction' },
  { value: 'VEGETARIAN',  label: 'Vegetarian' },
  { value: 'VEGAN',       label: 'Vegan' },
  { value: 'KETO',        label: 'Keto' },
  { value: 'PALEO',       label: 'Paleo' },
  { value: 'GLUTEN_FREE', label: 'Gluten-free' },
  { value: 'DAIRY_FREE',  label: 'Dairy-free' },
  { value: 'HALAL',       label: 'Halal' },
  { value: 'KOSHER',      label: 'Kosher' },
]

// NONE → no badge; all others get a label + color class
const DIET_BADGE: Partial<Record<DietType, { label: string; cls: string }>> = {
  VEGETARIAN:  { label: 'Vegetarian',  cls: 'badge-teal' },
  VEGAN:       { label: 'Vegan',       cls: 'badge-teal badge-teal--dark' },
  KETO:        { label: 'Keto',        cls: 'badge-amber' },
  PALEO:       { label: 'Paleo',       cls: 'badge-amber' },
  GLUTEN_FREE: { label: 'Gluten Free', cls: 'badge-blue' },
  DAIRY_FREE:  { label: 'Dairy Free',  cls: 'badge-blue' },
  HALAL:       { label: 'Halal',       cls: 'badge-coral' },
  KOSHER:      { label: 'Kosher',      cls: 'badge-coral' },
}

const CUISINE_OPTIONS = [
  '', 'Italian', 'Asian', 'Mexican', 'Mediterranean',
  'Indian', 'American', 'French', 'Japanese', 'Thai',
  'Greek', 'Middle Eastern', 'British',
]

const MEAL_TYPE_CHIPS: { value: MealType; label: string; emoji: string }[] = [
  { value: 'BREAKFAST', label: 'Breakfast', emoji: '🌅' },
  { value: 'LUNCH',     label: 'Lunch',     emoji: '☀️' },
  { value: 'DINNER',    label: 'Dinner',    emoji: '🌙' },
  { value: 'SNACK',     label: 'Snack',     emoji: '🍎' },
]

const TIME_CHIPS: { value: number; label: string }[] = [
  { value: 15, label: '≤ 15 min' },
  { value: 30, label: '≤ 30 min' },
  { value: 60, label: '≤ 1 hour' },
]

// ── Generate modal ────────────────────────────────────────

interface GenerateForm {
  prompt: string
  cuisinePreference: string
  maxCookTimeMinutes: string
  servings: string
}

function GenerateModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: (recipe: Recipe) => void
}) {
  const [form, setForm] = useState<GenerateForm>({
    prompt: '',
    cuisinePreference: '',
    maxCookTimeMinutes: '',
    servings: '',
  })
  const [error, setError] = useState('')

  const { mutate: generate, isPending } = useMutation({
    mutationFn: () =>
      recipeApi.generateRecipe({
        prompt: form.prompt.trim(),
        cuisinePreference: form.cuisinePreference || undefined,
        maxCookTimeMinutes: form.maxCookTimeMinutes
          ? Number(form.maxCookTimeMinutes)
          : undefined,
        servings: form.servings ? Number(form.servings) : undefined,
      }),
    onSuccess: (recipe) => {
      onSuccess(recipe)
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.message ??
          'Failed to generate recipe. Please try again.'
      )
    },
  })

  const set = (key: keyof GenerateForm, val: string) =>
    setForm((f) => ({ ...f, [key]: val }))

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="generate-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        <div className="modal-header">
          <div className="modal-title">
            <div className="ai-icon"><Sparkles size={16} /></div>
            <h2>AI Recipe Generator</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label>What would you like to cook? *</label>
            <textarea
              placeholder="e.g. a healthy high-protein dinner, quick pasta with chicken, vegan chocolate dessert…"
              value={form.prompt}
              onChange={(e) => set('prompt', e.target.value)}
            />
          </div>

          <div className="modal-grid">
            <div className="modal-field">
              <label>Cuisine preference</label>
              <select value={form.cuisinePreference} onChange={(e) => set('cuisinePreference', e.target.value)}>
                {CUISINE_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c || 'Any cuisine'}</option>
                ))}
              </select>
            </div>
            <div className="modal-field">
              <label>Max cook time (mins)</label>
              <input
                type="number"
                min={5}
                max={480}
                placeholder="e.g. 30"
                value={form.maxCookTimeMinutes}
                onChange={(e) => set('maxCookTimeMinutes', e.target.value)}
              />
            </div>
            <div className="modal-field">
              <label>Servings</label>
              <input
                type="number"
                min={1}
                max={50}
                placeholder="e.g. 4"
                value={form.servings}
                onChange={(e) => set('servings', e.target.value)}
              />
            </div>
          </div>
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-generate-btn"
            onClick={() => generate()}
            disabled={isPending || !form.prompt.trim()}
          >
            {isPending ? <Loader2 size={15} className="spin-icon" /> : <Sparkles size={15} />}
            {isPending ? 'Generating…' : 'Generate Recipe'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Import from URL modal ─────────────────────────────────

function ImportRecipeModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (recipe: Recipe) => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  const { mutate: importRecipe, isPending } = useMutation({
    mutationFn: () => recipeApi.importFromUrl(url.trim()),
    onSuccess: (recipe) => onSuccess(recipe),
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Failed to import recipe. Please try a different URL.')
    },
  })

  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be')

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="generate-modal"
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22 }}
      >
        <div className="modal-header">
          <div className="modal-title">
            <div className="ai-icon"><Link size={16} /></div>
            <h2>Import Recipe from URL</h2>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="modal-field">
            <label>Recipe URL *</label>
            <input
              type="url"
              placeholder="https://youtube.com/watch?v=… or any recipe page"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError('') }}
              disabled={isPending}
              autoFocus
            />
            <p className="import-url-hint">
              Paste a YouTube video link or any public recipe page URL.
              Instagram and paywalled sites are not supported.
            </p>
          </div>

          <div className="import-sources">
            <span className={`import-source-chip ${isYouTube ? 'import-source-chip--active' : ''}`}>YouTube</span>
            <span className="import-source-chip">AllRecipes</span>
            <span className="import-source-chip">BBC Food</span>
            <span className="import-source-chip">Tasty</span>
            <span className="import-source-chip">+ most recipe sites</span>
          </div>

          <div className="import-disclaimer">
            <Sparkles size={12} />
            Nutritional values are AI-estimated when not explicitly stated on the source page.
          </div>

          {isPending && (
            <div className="import-loading-status">
              <Loader2 size={14} className="spin-icon" />
              {isYouTube ? 'Fetching video transcript and extracting recipe…' : 'Fetching page and extracting recipe…'}
              &nbsp;This may take up to 20 seconds.
            </div>
          )}
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose} disabled={isPending}>Cancel</button>
          <button className="modal-generate-btn" onClick={() => importRecipe()} disabled={isPending || !url.trim()}>
            {isPending ? <Loader2 size={15} className="spin-icon" /> : <Link size={15} />}
            {isPending ? 'Importing…' : 'Import Recipe'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Recipe card ───────────────────────────────────────────

function RecipeCard({
  recipe,
  onClick,
  onToggleSave,
  onAddToPlan,
}: {
  recipe: Recipe
  onClick: () => void
  onToggleSave: (e: React.MouseEvent) => void
  onAddToPlan: (e: React.MouseEvent) => void
}) {
  const totalMins =
    (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)

  return (
    <motion.div
      className="recipe-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
    >
      <div className="card-img-wrap">
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="card-img" />
        ) : (
          <div className="card-img-placeholder">
            <span className="placeholder-emoji">
              {recipe.cuisine === 'Italian' ? '🍝'
                : recipe.cuisine === 'Asian' || recipe.cuisine === 'Japanese' ? '🍜'
                : recipe.cuisine === 'Mexican' ? '🌮'
                : recipe.cuisine === 'Indian' ? '🍛'
                : recipe.cuisine === 'Mediterranean' || recipe.cuisine === 'Greek' ? '🥗'
                : recipe.dietType === 'VEGAN' || recipe.dietType === 'VEGETARIAN' ? '🥗'
                : recipe.dietType === 'KETO' || recipe.dietType === 'PALEO' ? '🥩'
                : '🍽️'}
            </span>
            <span className="placeholder-label">
              {recipe.cuisine || DIET_BADGE[recipe.dietType]?.label || 'Recipe'}
            </span>
          </div>
        )}

        {recipe.isAiGenerated && (
          <div className="ai-badge"><Sparkles size={10} />AI</div>
        )}

        <div className="card-overlay-actions">
          <button
            className="card-plan-btn"
            onClick={onAddToPlan}
            title="Add to meal plan"
          >
            <CalendarPlus size={13} />
          </button>
          <button
            className={`card-save-btn ${recipe.isSaved ? 'saved' : ''}`}
            onClick={onToggleSave}
            title={recipe.isSaved ? 'Remove from saved' : 'Save recipe'}
          >
            <Heart size={14} fill={recipe.isSaved ? 'white' : 'none'} />
          </button>
        </div>
      </div>

      <div className="card-body">
        <h3 className="card-title">{recipe.title}</h3>
        {DIET_BADGE[recipe.dietType] && (
          <span className={`card-diet-tag ${DIET_BADGE[recipe.dietType]!.cls}`}>
            {DIET_BADGE[recipe.dietType]!.label}
          </span>
        )}
        {recipe.description && (
          <p className="card-desc">{recipe.description}</p>
        )}
        <div className="card-meta">
          {totalMins > 0 && (
            <span className="card-meta-item">
              <Clock size={12} />{totalMins}m
            </span>
          )}
          {recipe.calories && (
            <span className="card-meta-item">
              <Flame size={12} />{recipe.calories} kcal
            </span>
          )}
          {recipe.servings && (
            <span className="card-meta-item">
              <Users size={12} />{recipe.servings}
            </span>
          )}
        </div>
        {(recipe.protein || recipe.carbs || recipe.fat) && (
          <div className="card-macros">
            {recipe.protein != null && (
              <span className="card-macro card-macro--protein">P {recipe.protein}g</span>
            )}
            {recipe.carbs != null && (
              <span className="card-macro card-macro--carbs">C {recipe.carbs}g</span>
            )}
            {recipe.fat != null && (
              <span className="card-macro card-macro--fat">F {recipe.fat}g</span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────

type Tab = 'all' | 'saved'

export default function RecipesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [dietType, setDietType] = useState<DietType | ''>('')
  const [mealType, setMealType] = useState<MealType | ''>('')
  const [maxCookTime, setMaxCookTime] = useState<number | ''>('')
  const [cuisine, setCuisine] = useState('')
  const [page, setPage] = useState(1)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showPantryModal, setShowPantryModal] = useState(false)
  const [planRecipe, setPlanRecipe] = useState<{ id: string; title: string } | null>(null)

  // All recipes query
  const { data, isLoading, isError } = useQuery({
    queryKey: ['recipes', { page, search, dietType, mealType, maxCookTime, cuisine }],
    queryFn: () =>
      recipeApi.getRecipes({
        page,
        limit: 12,
        search: search || undefined,
        dietType: (dietType as DietType) || undefined,
        mealType: (mealType as MealType) || undefined,
        maxCookTime: (maxCookTime as number) || undefined,
        cuisine: cuisine || undefined,
      }),
    enabled: tab === 'all',
  })

  // Saved recipes query
  const { data: savedData, isLoading: savedLoading, isError: savedError } = useQuery({
    queryKey: ['recipes-saved'],
    queryFn: recipeApi.getSavedRecipes,
    enabled: tab === 'saved',
  })

  // Optimistically toggle save
  const { mutate: toggleSave } = useMutation({
    mutationFn: ({ id, isSaved }: { id: string; isSaved: boolean }) =>
      isSaved ? recipeApi.unsaveRecipe(id) : recipeApi.saveRecipe(id),
    onMutate: async ({ id, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ['recipes'] })
      // Optimistic update — flip isSaved flag in list cache
      queryClient.setQueriesData<{ recipes: Recipe[]; pagination: any }>(
        { queryKey: ['recipes'] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            recipes: old.recipes.map((r) =>
              r.id === id ? { ...r, isSaved: !isSaved } : r
            ),
          }
        }
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['recipes-saved'] })
    },
  })

  const handleToggleSave = useCallback(
    (e: React.MouseEvent, recipe: Recipe) => {
      e.stopPropagation()
      toggleSave({ id: recipe.id, isSaved: recipe.isSaved ?? false })
    },
    [toggleSave]
  )

  const handleTabChange = (t: Tab) => {
    setTab(t)
    setPage(1)
  }

  const handleSearchChange = (val: string) => {
    setSearch(val)
    setPage(1)
  }

  const handleGenerateSuccess = (recipe: Recipe) => {
    setShowGenerateModal(false)
    router.push(`/recipes/${recipe.id}`)
  }

  const handleImportSuccess = (recipe: Recipe) => {
    setShowImportModal(false)
    queryClient.invalidateQueries({ queryKey: ['recipes'] })
    router.push(`/recipes/${recipe.id}`)
  }

  // Decide what to render
  const recipes = tab === 'all' ? data?.recipes ?? [] : savedData ?? []
  const pagination = tab === 'all' ? data?.pagination : null
  const loading = tab === 'all' ? isLoading : savedLoading
  const hasError = tab === 'all' ? isError : savedError

  return (
    <div className="recipes-root">
      {/* ── Header ── */}
      <motion.div
        className="recipes-header"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="recipes-header-text">
          <h1>Recipes</h1>
          <p>Discover dishes, or let AI create something perfect for you.</p>
        </div>
        <div className="recipes-header-actions">
          <button className="icon-action-btn" onClick={() => setShowPantryModal(true)} aria-label="Cook from my pantry">
            <Refrigerator size={18} />
            <span className="icon-action-tooltip">Cook from my pantry</span>
          </button>
          <button className="icon-action-btn" onClick={() => setShowImportModal(true)} aria-label="Import from URL">
            <Link size={18} />
            <span className="icon-action-tooltip">Import from URL</span>
          </button>
          <button className="generate-btn" onClick={() => setShowGenerateModal(true)}>
            <Sparkles size={16} />
            Generate with AI
          </button>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <div className="recipes-tabs">
        {(['all', 'saved'] as const).map(t => (
          <button
            key={t}
            className={`tab-btn ${tab === t ? 'tab-btn--active' : ''}`}
            onClick={() => handleTabChange(t)}
          >
            {tab === t && (
              <motion.div
                className="tab-pill"
                layoutId="recipes-tab-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            <span className="tab-label">
              {t === 'all' ? 'All Recipes' : 'Saved'}
            </span>
          </button>
        ))}
      </div>

      {/* ── Toolbar ── */}
      {tab === 'all' && (
        <div className="recipes-filters">
          {/* Search + selects row */}
          <div className="recipes-toolbar">
            <div className="search-wrap">
              <Search size={15} />
              <input
                className="search-input"
                placeholder="Search recipes…"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
            <select
              className="filter-select"
              value={dietType}
              onChange={(e) => { setDietType(e.target.value as DietType | ''); setPage(1) }}
            >
              {DIET_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <select
              className="filter-select"
              value={cuisine}
              onChange={(e) => { setCuisine(e.target.value); setPage(1) }}
            >
              {CUISINE_OPTIONS.map((c) => (
                <option key={c} value={c}>{c || 'All cuisines'}</option>
              ))}
            </select>
          </div>

          {/* Meal type chips */}
          <div className="filter-chips-row">
            <span className="filter-chips-label">Meal</span>
            <div className="filter-chips">
              {MEAL_TYPE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  className={`filter-chip ${mealType === chip.value ? 'filter-chip--active' : ''}`}
                  onClick={() => { setMealType(mealType === chip.value ? '' : chip.value); setPage(1) }}
                >
                  <span>{chip.emoji}</span>
                  {chip.label}
                </button>
              ))}
            </div>

            <span className="filter-chips-label filter-chips-label--gap">Time</span>
            <div className="filter-chips">
              {TIME_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  className={`filter-chip ${maxCookTime === chip.value ? 'filter-chip--active' : ''}`}
                  onClick={() => { setMaxCookTime(maxCookTime === chip.value ? '' : chip.value); setPage(1) }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Clear all active filters */}
            {(mealType || maxCookTime || dietType || cuisine || search) && (
              <button
                className="filter-clear-btn"
                onClick={() => {
                  setMealType(''); setMaxCookTime(''); setDietType('')
                  setCuisine(''); setSearch(''); setPage(1)
                }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="recipes-loading">
          <Loader2 size={28} className="spin-icon" />
        </div>
      ) : hasError ? (
        <div className="recipes-empty">
          <ChefHat size={40} strokeWidth={1.2} />
          <p>Couldn't load recipes. Check your connection and try again.</p>
        </div>
      ) : recipes.length === 0 ? (
        <div className="recipes-empty">
          {tab === 'saved' ? (
            <>
              <UtensilsCrossed size={40} strokeWidth={1.2} />
              <p>No saved recipes yet. Tap the heart on any recipe to save it.</p>
            </>
          ) : (
            <>
              <ChefHat size={40} strokeWidth={1.2} />
              <p>No recipes found. Try adjusting your filters or generate one with AI.</p>
            </>
          )}
        </div>
      ) : (
        <div className="recipe-grid">
          {recipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => router.push(`/recipes/${recipe.id}`)}
              onToggleSave={(e) => handleToggleSave(e, recipe)}
              onAddToPlan={(e) => { e.stopPropagation(); setPlanRecipe({ id: recipe.id, title: recipe.title }) }}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {pagination && pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            className="page-btn"
            disabled={!pagination.hasPrev}
            onClick={() => setPage((p) => p - 1)}
          >
            ←
          </button>
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pagination.totalPages)
            .reduce<(number | '…')[]>((acc, p, idx, arr) => {
              if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('…')
              acc.push(p)
              return acc
            }, [])
            .map((p, idx) =>
              p === '…' ? (
                <span key={`ellipsis-${idx}`} className="page-info">…</span>
              ) : (
                <button
                  key={p}
                  className={`page-btn ${p === page ? 'active' : ''}`}
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </button>
              )
            )}
          <button
            className="page-btn"
            disabled={!pagination.hasNext}
            onClick={() => setPage((p) => p + 1)}
          >
            →
          </button>
        </div>
      )}

      {/* ── AI Generate Modal ── */}
      <AnimatePresence>
        {showGenerateModal && (
          <GenerateModal
            onClose={() => setShowGenerateModal(false)}
            onSuccess={handleGenerateSuccess}
          />
        )}
      </AnimatePresence>

      {/* ── Import from URL Modal ── */}
      <AnimatePresence>
        {showImportModal && (
          <ImportRecipeModal
            onClose={() => setShowImportModal(false)}
            onSuccess={handleImportSuccess}
          />
        )}
      </AnimatePresence>

      {/* ── Pantry Suggestions Modal ── */}
      <AnimatePresence>
        {showPantryModal && (
          <PantrySuggestionsModal onClose={() => setShowPantryModal(false)} />
        )}
      </AnimatePresence>

      {/* ── Add to Plan Modal ── */}
      <AnimatePresence>
        {planRecipe && (
          <AddToPlanModal
            recipeId={planRecipe.id}
            recipeTitle={planRecipe.title}
            onClose={() => setPlanRecipe(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
