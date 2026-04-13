'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChefHat, Target, Leaf, ArrowRight, ArrowLeft,
  Loader2, Check, Sparkles,
} from 'lucide-react'
import { profileApi, DietType } from '@/services/profile.service'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import './onboarding.css'

// ── Types ─────────────────────────────────

interface OnboardingData {
  dietType: DietType
  calorieGoal: number | ''
  proteinGoal: number | ''
  carbGoal: number | ''
  fatGoal: number | ''
  allergies: string
  healthConditions: string
  foodPreferences: string
}

// ── Diet options ──────────────────────────

const DIET_OPTIONS: { value: DietType; label: string; emoji: string; desc: string }[] = [
  { value: 'NONE',       label: 'No restriction', emoji: '🍽️', desc: 'I eat everything' },
  { value: 'VEGETARIAN', label: 'Vegetarian',     emoji: '🥗', desc: 'No meat or fish' },
  { value: 'VEGAN',      label: 'Vegan',          emoji: '🌱', desc: 'No animal products' },
  { value: 'KETO',       label: 'Keto',           emoji: '🥩', desc: 'Low-carb, high-fat' },
  { value: 'PALEO',      label: 'Paleo',          emoji: '🫙', desc: 'Whole foods only' },
]

// ── Step meta ─────────────────────────────

const STEPS = [
  { label: 'Diet type',   icon: <Leaf size={16} /> },
  { label: 'Your goals',  icon: <Target size={16} /> },
  { label: 'Preferences', icon: <Sparkles size={16} /> },
]

// ── Slide variants ────────────────────────

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 48 : -48 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir: number) => ({ opacity: 0, x: dir > 0 ? -48 : 48 }),
}

// ── Main page ─────────────────────────────

export default function OnboardingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [data, setData] = useState<OnboardingData>({
    dietType:        'NONE',
    calorieGoal:     2000,
    proteinGoal:     150,
    carbGoal:        200,
    fatGoal:         65,
    allergies:       '',
    healthConditions:'',
    foodPreferences: '',
  })

  const set = <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) =>
    setData(d => ({ ...d, [key]: val }))

  const goNext = () => { setDir(1); setStep(s => s + 1) }
  const goPrev = () => { setDir(-1); setStep(s => s - 1) }

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    try {
      await profileApi.updateProfile({
        dietType:         data.dietType,
        calorieGoal:      data.calorieGoal === '' ? null : Number(data.calorieGoal),
        proteinGoal:      data.proteinGoal === '' ? null : Number(data.proteinGoal),
        carbGoal:         data.carbGoal    === '' ? null : Number(data.carbGoal),
        fatGoal:          data.fatGoal     === '' ? null : Number(data.fatGoal),
        allergies:        data.allergies.trim()        || null,
        healthConditions: data.healthConditions.trim() || null,
        foodPreferences:  data.foodPreferences.trim()  || null,
      })
      // Invalidate profile cache so dashboard shows fresh data
      await queryClient.invalidateQueries({ queryKey: ['profile'] })
      router.push('/dashboard')
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="ob-root">
      {/* ── Left brand panel ── */}
      <div className="ob-brand">
        <div className="ob-brand-inner">
          <div className="ob-brand-logo">
            <Image src="/images/appIcon.png" alt="What to Cook?" width={44} height={44} style={{ objectFit: 'contain', borderRadius: 8 }} />
            <span>What to Cook?</span>
          </div>
          <div className="ob-brand-copy">
            <h2>Let's personalise<br /><em>your kitchen</em></h2>
            <p>A quick 3-step setup so your meal plans, recipes, and insights are built just for you.</p>
          </div>
          {/* Step list */}
          <div className="ob-step-list">
            {STEPS.map((s, i) => (
              <div key={i} className={`ob-step-item ${i === step ? 'ob-step-item--active' : ''} ${i < step ? 'ob-step-item--done' : ''}`}>
                <div className="ob-step-dot">
                  {i < step ? <Check size={12} /> : s.icon}
                </div>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
          <div className="ob-blob ob-blob-1" />
          <div className="ob-blob ob-blob-2" />
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div className="ob-form-panel">
        {/* Progress bar */}
        <div className="ob-progress-bar">
          <motion.div
            className="ob-progress-fill"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>

        <div className="ob-form-inner">
          {/* Step counter */}
          <p className="ob-step-counter">Step {step + 1} of {STEPS.length}</p>

          {/* Animated step content */}
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
              className="ob-step-content"
            >
              {step === 0 && <StepDiet data={data} set={set} />}
              {step === 1 && <StepGoals data={data} set={set} />}
              {step === 2 && <StepPreferences data={data} set={set} />}
            </motion.div>
          </AnimatePresence>

          {/* Error */}
          {error && <p className="ob-error">{error}</p>}

          {/* Navigation */}
          <div className="ob-nav">
            {step > 0 ? (
              <button className="ob-btn-back" onClick={goPrev} disabled={saving}>
                <ArrowLeft size={15} /> Back
              </button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <button className="ob-btn-next" onClick={goNext}>
                Continue <ArrowRight size={15} />
              </button>
            ) : (
              <button className="ob-btn-finish" onClick={handleFinish} disabled={saving}>
                {saving
                  ? <><Loader2 size={15} className="ob-spin" /> Saving…</>
                  : <><ChefHat size={15} /> Let's cook!</>
                }
              </button>
            )}
          </div>

          {/* Skip entirely — step 2 only */}
          {step === 2 && (
            <button className="ob-skip" onClick={handleFinish} disabled={saving}>
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step 1: Diet type ─────────────────────

function StepDiet({
  data,
  set,
}: {
  data: OnboardingData
  set: <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => void
}) {
  return (
    <div className="ob-step">
      <h2 className="ob-step-title">What's your diet type?</h2>
      <p className="ob-step-sub">This helps us filter recipes and build meal plans that work for you.</p>
      <div className="ob-diet-grid">
        {DIET_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`ob-diet-card ${data.dietType === opt.value ? 'ob-diet-card--active' : ''}`}
            onClick={() => set('dietType', opt.value)}
          >
            <span className="ob-diet-emoji">{opt.emoji}</span>
            <span className="ob-diet-label">{opt.label}</span>
            <span className="ob-diet-desc">{opt.desc}</span>
            {data.dietType === opt.value && (
              <motion.div
                className="ob-diet-check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Check size={12} />
              </motion.div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Step 2: Goals ─────────────────────────

function StepGoals({
  data,
  set,
}: {
  data: OnboardingData
  set: <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => void
}) {
  return (
    <div className="ob-step">
      <h2 className="ob-step-title">Set your daily goals</h2>
      <p className="ob-step-sub">We'll use these to track your nutrition and build balanced meal plans.</p>
      <div className="ob-goals-grid">
        <GoalField
          label="Calories"
          unit="kcal"
          color="coral"
          value={data.calorieGoal}
          onChange={v => set('calorieGoal', v)}
          placeholder="2000"
        />
        <GoalField
          label="Protein"
          unit="g"
          color="teal"
          value={data.proteinGoal}
          onChange={v => set('proteinGoal', v)}
          placeholder="150"
        />
        <GoalField
          label="Carbs"
          unit="g"
          color="amber"
          value={data.carbGoal}
          onChange={v => set('carbGoal', v)}
          placeholder="200"
        />
        <GoalField
          label="Fat"
          unit="g"
          color="blue"
          value={data.fatGoal}
          onChange={v => set('fatGoal', v)}
          placeholder="65"
        />
      </div>
      <p className="ob-goals-hint">💡 Not sure? Our defaults are based on a standard healthy adult. You can update these anytime in Profile.</p>
    </div>
  )
}

function GoalField({
  label, unit, color, value, onChange, placeholder,
}: {
  label: string; unit: string; color: string
  value: number | ''; onChange: (v: number | '') => void; placeholder: string
}) {
  return (
    <div className={`ob-goal-field ob-goal-field--${color}`}>
      <label className="ob-goal-label">{label}</label>
      <div className="ob-goal-input-wrap">
        <input
          type="number"
          className="ob-goal-input"
          placeholder={placeholder}
          value={value}
          min={0}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        <span className="ob-goal-unit">{unit}</span>
      </div>
    </div>
  )
}

// ── Step 3: Preferences ───────────────────

function StepPreferences({
  data,
  set,
}: {
  data: OnboardingData
  set: <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => void
}) {
  return (
    <div className="ob-step">
      <h2 className="ob-step-title">Any restrictions or preferences?</h2>
      <p className="ob-step-sub">Optional — but helps the AI make much better suggestions for you.</p>
      <div className="ob-pref-fields">
        <div className="ob-pref-field">
          <label>Allergies or intolerances</label>
          <input
            type="text"
            placeholder="e.g. nuts, gluten, dairy, shellfish"
            value={data.allergies}
            onChange={e => set('allergies', e.target.value)}
          />
        </div>
        <div className="ob-pref-field">
          <label>Health conditions</label>
          <input
            type="text"
            placeholder="e.g. diabetes, hypertension, IBS"
            value={data.healthConditions}
            onChange={e => set('healthConditions', e.target.value)}
          />
        </div>
        <div className="ob-pref-field">
          <label>Food preferences</label>
          <input
            type="text"
            placeholder="e.g. spicy food, Mediterranean, quick meals"
            value={data.foodPreferences}
            onChange={e => set('foodPreferences', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
