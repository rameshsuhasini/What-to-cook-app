'use client'

import './recipe-detail.css'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Clock, Users, Flame, Sparkles, Heart,
  ShoppingBasket, BookOpen, Loader2, AlertCircle, CalendarPlus,
} from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { recipeApi, DietType } from '@/services/recipe.service'
import AddToPlanModal from '@/components/AddToPlanModal'

const DIET_LABELS: Record<DietType, string> = {
  NONE:       '',
  VEGETARIAN: 'Vegetarian',
  VEGAN:      'Vegan',
  KETO:       'Keto',
  PALEO:      'Paleo',
  GLUTEN_FREE:'Gluten-free',
  DAIRY_FREE: 'Dairy-free',
  HALAL:      'Halal',
  KOSHER:     'Kosher',
}

const CUISINE_EMOJI: Record<string, string> = {
  Italian:       '🍝',
  Asian:         '🍜',
  Japanese:      '🍣',
  Mexican:       '🌮',
  Indian:        '🍛',
  Mediterranean: '🥗',
  Greek:         '🫒',
  American:      '🍔',
  French:        '🥐',
  Thai:          '🍲',
}

export default function RecipeDetailPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const [showPlanModal, setShowPlanModal] = useState(false)

  const { data: recipe, isLoading, isError } = useQuery({
    queryKey: ['recipe', id],
    queryFn: () => recipeApi.getRecipeById(id),
  })

  const { mutate: toggleSave, isPending: isSaving } = useMutation({
    mutationFn: () =>
      recipe?.isSaved
        ? recipeApi.unsaveRecipe(id)
        : recipeApi.saveRecipe(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['recipes-saved'] })
    },
  })

  if (isLoading) {
    return (
      <div className="detail-root detail-loading">
        <Loader2 size={28} className="spin-icon" />
      </div>
    )
  }

  if (isError || !recipe) {
    return (
      <div className="detail-root detail-error">
        <AlertCircle size={32} strokeWidth={1.4} />
        <p>Recipe not found.</p>
        <button className="detail-back" onClick={() => router.back()}>
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    )
  }

  const totalMins = (recipe.prepTimeMinutes ?? 0) + (recipe.cookTimeMinutes ?? 0)
  const dietLabel = DIET_LABELS[recipe.dietType]
  const emoji = recipe.cuisine ? (CUISINE_EMOJI[recipe.cuisine] ?? '🍽️') : '🍽️'

  return (
    <div className="detail-root">
      <button className="detail-back" onClick={() => router.back()}>
        <ArrowLeft size={14} /> Back to recipes
      </button>

      {/* ── Hero card ── */}
      <motion.div
        className="detail-hero"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {recipe.imageUrl ? (
          <img src={recipe.imageUrl} alt={recipe.title} className="detail-hero-img" />
        ) : (
          <div className="detail-hero-placeholder">{emoji}</div>
        )}

        <div className="detail-hero-body">
          <div className="detail-badges">
            {dietLabel && (
              <span className="detail-badge diet">{dietLabel}</span>
            )}
            {recipe.isAiGenerated && (
              <span className="detail-badge ai">
                <Sparkles size={10} />AI Generated
              </span>
            )}
            {recipe.cuisine && (
              <span className="detail-badge cuisine">{recipe.cuisine}</span>
            )}
          </div>

          <h1 className="detail-title">{recipe.title}</h1>

          {recipe.description && (
            <p className="detail-description">{recipe.description}</p>
          )}

          <div className="detail-meta-row">
            {recipe.prepTimeMinutes != null && (
              <span className="detail-meta-item">
                <Clock size={14} />
                Prep <strong>{recipe.prepTimeMinutes}m</strong>
              </span>
            )}
            {recipe.cookTimeMinutes != null && (
              <span className="detail-meta-item">
                <Clock size={14} />
                Cook <strong>{recipe.cookTimeMinutes}m</strong>
              </span>
            )}
            {totalMins > 0 && recipe.prepTimeMinutes != null && recipe.cookTimeMinutes != null && (
              <span className="detail-meta-item">
                <Clock size={14} />
                Total <strong>{totalMins}m</strong>
              </span>
            )}
            {recipe.servings && (
              <span className="detail-meta-item">
                <Users size={14} />
                <strong>{recipe.servings}</strong> servings
              </span>
            )}
          </div>

          <div className="detail-actions">
            <button
              className={`action-save-btn ${recipe.isSaved ? 'saved' : ''}`}
              onClick={() => toggleSave()}
              disabled={isSaving}
            >
              <Heart size={15} fill={recipe.isSaved ? 'white' : 'none'} />
              {recipe.isSaved ? 'Saved' : 'Save Recipe'}
            </button>
            <button
              className="action-plan-btn"
              onClick={() => setShowPlanModal(true)}
            >
              <CalendarPlus size={15} />
              Add to Meal Plan
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── Macro strip ── */}
      {(recipe.calories || recipe.protein || recipe.carbs || recipe.fat) && (
        <motion.div
          className="macro-strip"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {recipe.calories != null && (
            <div className="macro-tile calories">
              <div className="macro-tile-value">{recipe.calories}</div>
              <div className="macro-tile-label">Calories</div>
              <div className="macro-tile-unit">kcal / serving</div>
            </div>
          )}
          {recipe.protein != null && (
            <div className="macro-tile protein">
              <div className="macro-tile-value">{recipe.protein}g</div>
              <div className="macro-tile-label">Protein</div>
              <div className="macro-tile-unit">per serving</div>
            </div>
          )}
          {recipe.carbs != null && (
            <div className="macro-tile carbs">
              <div className="macro-tile-value">{recipe.carbs}g</div>
              <div className="macro-tile-label">Carbs</div>
              <div className="macro-tile-unit">per serving</div>
            </div>
          )}
          {recipe.fat != null && (
            <div className="macro-tile fat">
              <div className="macro-tile-value">{recipe.fat}g</div>
              <div className="macro-tile-label">Fat</div>
              <div className="macro-tile-unit">per serving</div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Ingredients + Steps ── */}
      <motion.div
        className="detail-columns"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-title">
              <ShoppingBasket size={13} />
              Ingredients
            </div>
            <div className="ingredients-list">
              {recipe.ingredients.map((ing) => (
                <div key={ing.id} className="ingredient-row">
                  <span className="ingredient-name">{ing.ingredientName}</span>
                  {(ing.quantity != null || ing.unit) && (
                    <span className="ingredient-qty">
                      {ing.quantity != null ? ing.quantity : ''}
                      {ing.unit ? ` ${ing.unit}` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <div className="detail-section">
            <div className="detail-section-title">
              <BookOpen size={13} />
              Method
            </div>
            <div className="steps-list">
              {recipe.steps
                .slice()
                .sort((a, b) => a.stepNumber - b.stepNumber)
                .map((step) => (
                  <div key={step.id} className="step-row">
                    <div className="step-num">{step.stepNumber}</div>
                    <p className="step-text">{step.instructionText}</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </motion.div>
      {/* ── Add to Plan Modal ── */}
      <AnimatePresence>
        {showPlanModal && (
          <AddToPlanModal
            recipeId={recipe.id}
            recipeTitle={recipe.title}
            onClose={() => setShowPlanModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
