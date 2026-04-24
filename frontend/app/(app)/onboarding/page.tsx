'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChefHat, Target, Leaf, ArrowRight, ArrowLeft,
  Loader2, Check, Sparkles, User, Coffee, UtensilsCrossed, Moon,
  Flame,
} from 'lucide-react'
import { profileApi, DietType, Gender, ActivityLevel } from '@/services/profile.service'
import { aiApi } from '@/services/ai.service'
import { useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import './onboarding.css'

// ── Types ─────────────────────────────────

type WeightGoal = 'LOSE' | 'MAINTAIN' | 'GAIN'

interface OnboardingData {
  // Step 1 — Diet
  dietType: DietType
  // Step 2 — Body stats
  age: number | ''
  gender: Gender | ''
  heightCm: number | ''
  weightKg: number | ''
  targetWeightKg: number | ''
  activityLevel: ActivityLevel | ''
  // Step 3 — Smart goals
  weightGoal: WeightGoal | ''
  calorieGoal: number | ''
  proteinGoal: number | ''
  carbGoal: number | ''
  fatGoal: number | ''
  // Step 4 — Preferences
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

const GENDER_OPTIONS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'MALE',              label: 'Male',            emoji: '♂️' },
  { value: 'FEMALE',            label: 'Female',          emoji: '♀️' },
  { value: 'OTHER',             label: 'Other',           emoji: '⚧' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say', emoji: '🤐' },
]

// ── Activity level options ────────────────

const ACTIVITY_OPTIONS: { value: ActivityLevel; emoji: string; label: string; desc: string; multiplier: number }[] = [
  { value: 'SEDENTARY',   emoji: '🛋️', label: 'Sedentary',          desc: 'Little or no exercise',              multiplier: 1.2   },
  { value: 'LIGHT',       emoji: '🚶', label: 'Lightly active',      desc: 'Exercise 1–3 days/week',             multiplier: 1.375 },
  { value: 'MODERATE',    emoji: '🏃', label: 'Moderately active',   desc: 'Exercise 3–5 days/week',             multiplier: 1.55  },
  { value: 'ACTIVE',      emoji: '💪', label: 'Very active',         desc: 'Exercise 6–7 days/week',             multiplier: 1.725 },
  { value: 'VERY_ACTIVE', emoji: '🔥', label: 'Extra active',        desc: 'Physical job + hard daily training', multiplier: 1.9   },
]

// ── Goal type options ─────────────────────

const GOAL_TYPE_OPTIONS: { value: WeightGoal; emoji: string; label: string; desc: string; delta: number }[] = [
  { value: 'LOSE',     emoji: '🎯', label: 'Lose weight',   desc: 'Calorie deficit',    delta: -500 },
  { value: 'MAINTAIN', emoji: '⚖️', label: 'Stay healthy',  desc: 'Maintain weight',    delta: 0    },
  { value: 'GAIN',     emoji: '💪', label: 'Build muscle',  desc: 'Lean bulk',          delta: +300 },
]

// ── TDEE helpers ──────────────────────────

function calcBMR(weightKg: number, heightCm: number, age: number, gender: Gender | ''): number {
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age)
  if (gender === 'MALE')   return base + 5
  if (gender === 'FEMALE') return base - 161
  return base - 78
}

function calcTDEE(weightKg: number, heightCm: number, age: number, gender: Gender | '', activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_OPTIONS.find(a => a.value === activityLevel)?.multiplier ?? 1.55
  return Math.round(calcBMR(weightKg, heightCm, age, gender) * multiplier)
}

function suggestMacros(calories: number, goal: WeightGoal) {
  const splits: Record<WeightGoal, { p: number; c: number; f: number }> = {
    LOSE:     { p: 0.30, c: 0.35, f: 0.35 },
    MAINTAIN: { p: 0.25, c: 0.45, f: 0.30 },
    GAIN:     { p: 0.30, c: 0.45, f: 0.25 },
  }
  const { p, c, f } = splits[goal]
  return {
    protein: Math.round(calories * p / 4),
    carbs:   Math.round(calories * c / 4),
    fat:     Math.round(calories * f / 9),
  }
}

// ── Step meta ─────────────────────────────

const STEPS = [
  { label: 'Diet type',   icon: <Leaf size={16} /> },
  { label: 'Body stats',  icon: <User size={16} /> },
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

type Phase = 'form' | 'generating'

export default function OnboardingPage() {
  const router = useRouter()
  const queryClient = useQueryClient()

  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [phase, setPhase] = useState<Phase>('form')

  const [data, setData] = useState<OnboardingData>({
    dietType:        'NONE',
    age:             '',
    gender:          '',
    heightCm:        '',
    weightKg:        '',
    targetWeightKg:  '',
    activityLevel:   '',
    weightGoal:      '',
    calorieGoal:     '',
    proteinGoal:     '',
    carbGoal:        '',
    fatGoal:         '',
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
        age:              data.age              === '' ? null : Number(data.age),
        gender:           data.gender           === '' ? null : data.gender,
        heightCm:         data.heightCm         === '' ? null : Number(data.heightCm),
        weightKg:         data.weightKg         === '' ? null : Number(data.weightKg),
        targetWeightKg:   data.targetWeightKg   === '' ? null : Number(data.targetWeightKg),
        activityLevel:    data.activityLevel     === '' ? null : data.activityLevel,
        calorieGoal:      data.calorieGoal      === '' ? null : Number(data.calorieGoal),
        proteinGoal:      data.proteinGoal      === '' ? null : Number(data.proteinGoal),
        carbGoal:         data.carbGoal         === '' ? null : Number(data.carbGoal),
        fatGoal:          data.fatGoal          === '' ? null : Number(data.fatGoal),
        allergies:        data.allergies.trim()        || null,
        healthConditions: data.healthConditions.trim() || null,
        foodPreferences:  data.foodPreferences.trim()  || null,
      })
      await queryClient.invalidateQueries({ queryKey: ['profile'] })

      // Switch to generating screen, then fire starter pack in background
      setPhase('generating')
      setSaving(false)

      try {
        await aiApi.generateStarterPack()
      } catch {
        // Generation failed — still navigate, recipes page shows empty state
      }

      router.push('/recipes')
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  // Show generating screen while starter pack is being built
  if (phase === 'generating') {
    return <GeneratingScreen />
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
            <p>A quick 4-step setup so your meal plans, recipes, and insights are built just for you.</p>
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
            transition={{ duration: 0.4, ease: 'easeOut' as const }}
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
              {step === 1 && <StepBodyStats data={data} set={set} />}
              {step === 2 && <StepSmartGoals data={data} set={set} />}
              {step === 3 && <StepPreferences data={data} set={set} />}
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

          {/* Skip — steps 1, 2, 3 */}
          {step >= 1 && (
            <button
              className="ob-skip"
              onClick={step === STEPS.length - 1 ? handleFinish : goNext}
              disabled={saving}
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Generating screen ─────────────────────

const GEN_ITEMS = [
  { icon: <Coffee size={15} />,         label: 'Breakfast recipes',  delay: 0.8 },
  { icon: <Leaf size={15} />,           label: 'Lunch recipes',      delay: 2.5 },
  { icon: <Moon size={15} />,           label: 'Dinner recipes',     delay: 4.2 },
  { icon: <UtensilsCrossed size={15} />, label: 'Personalising to your profile', delay: 6.0 },
]

function GeneratingScreen() {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    const timers = GEN_ITEMS.map((item, i) =>
      setTimeout(() => setVisibleCount(i + 1), item.delay * 1000)
    )
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="ob-gen-root">
      <motion.div
        className="ob-gen-card"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' as const }}
      >
        {/* Logo */}
        <div className="ob-gen-logo">
          <Image src="/images/appIcon.png" alt="What to Cook?" width={48} height={48} style={{ objectFit: 'contain', borderRadius: 10 }} />
        </div>

        {/* Animated chef hat */}
        <motion.div
          className="ob-gen-icon"
          animate={{ rotate: [0, -8, 8, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
        >
          <ChefHat size={32} />
        </motion.div>

        <h2 className="ob-gen-title">Building your recipe collection</h2>
        <p className="ob-gen-sub">Personalised just for you — this takes about 20 seconds</p>

        {/* Progress dots */}
        <div className="ob-gen-dots">
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              className="ob-gen-dot"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        {/* Animated item list */}
        <div className="ob-gen-items">
          {GEN_ITEMS.map((item, i) => (
            <AnimatePresence key={i}>
              {visibleCount > i && (
                <motion.div
                  className="ob-gen-item"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, ease: 'easeOut' as const }}
                >
                  <span className="ob-gen-item-icon">{item.icon}</span>
                  <span className="ob-gen-item-label">{item.label}</span>
                  <motion.span
                    className="ob-gen-item-check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  >
                    <Check size={11} />
                  </motion.span>
                </motion.div>
              )}
            </AnimatePresence>
          ))}
        </div>
      </motion.div>
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

// ── Step 2: Body stats ────────────────────

function StepBodyStats({
  data,
  set,
}: {
  data: OnboardingData
  set: <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => void
}) {
  return (
    <div className="ob-step">
      <h2 className="ob-step-title">Tell us about yourself</h2>
      <p className="ob-step-sub">Used for BMI, calorie estimates, and weight tracking. All optional — you can update anytime.</p>

      {/* Gender */}
      <div className="ob-body-section">
        <label className="ob-body-label">Gender</label>
        <div className="ob-gender-grid">
          {GENDER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ob-gender-btn ${data.gender === opt.value ? 'ob-gender-btn--active' : ''}`}
              onClick={() => set('gender', opt.value)}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Numeric fields */}
      <div className="ob-body-grid">
        <BodyField label="Age" unit="yrs" value={data.age} onChange={v => set('age', v)} placeholder="28" min={10} max={120} />
        <BodyField label="Height" unit="cm" value={data.heightCm} onChange={v => set('heightCm', v)} placeholder="170" min={100} max={250} />
        <BodyField label="Current weight" unit="kg" value={data.weightKg} onChange={v => set('weightKg', v)} placeholder="70" min={20} max={300} />
        <BodyField label="Target weight" unit="kg" value={data.targetWeightKg} onChange={v => set('targetWeightKg', v)} placeholder="65" min={20} max={300} />
      </div>

      {/* Activity level */}
      <div className="ob-body-section">
        <label className="ob-body-label">Activity level</label>
        <div className="ob-activity-grid">
          {ACTIVITY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              className={`ob-activity-btn ${data.activityLevel === opt.value ? 'ob-activity-btn--active' : ''}`}
              onClick={() => set('activityLevel', opt.value)}
            >
              <span className="ob-activity-emoji">{opt.emoji}</span>
              <span className="ob-activity-text">
                <span className="ob-activity-label">{opt.label}</span>
                <span className="ob-activity-desc">{opt.desc}</span>
              </span>
              {data.activityLevel === opt.value && (
                <motion.span
                  className="ob-activity-check"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                >
                  <Check size={11} />
                </motion.span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="ob-goals-hint">💡 This information stays private and is only used to personalise your experience.</p>
    </div>
  )
}

function BodyField({
  label, unit, value, onChange, placeholder, min, max,
}: {
  label: string; unit: string; value: number | ''
  onChange: (v: number | '') => void; placeholder: string
  min?: number; max?: number
}) {
  return (
    <div className="ob-body-field">
      <label className="ob-body-field-label">{label}</label>
      <div className="ob-goal-input-wrap">
        <input
          type="number"
          className="ob-goal-input"
          placeholder={placeholder}
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
        <span className="ob-goal-unit">{unit}</span>
      </div>
    </div>
  )
}

// ── Step 3: Smart Goals ───────────────────

function StepSmartGoals({
  data,
  set,
}: {
  data: OnboardingData
  set: <K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) => void
}) {
  const canCalc = data.weightKg !== '' && data.heightCm !== '' && data.age !== '' && data.activityLevel !== ''

  const tdee = canCalc
    ? calcTDEE(Number(data.weightKg), Number(data.heightCm), Number(data.age), data.gender, data.activityLevel as ActivityLevel)
    : null

  const pickGoal = (goal: WeightGoal) => {
    set('weightGoal', goal)
    if (!tdee) return
    const calories = Math.max(1200, tdee + GOAL_TYPE_OPTIONS.find(g => g.value === goal)!.delta)
    const macros = suggestMacros(calories, goal)
    set('calorieGoal', calories)
    set('proteinGoal', macros.protein)
    set('carbGoal',    macros.carbs)
    set('fatGoal',     macros.fat)
  }

  // Fallback to manual entry if body stats were skipped
  if (!canCalc) {
    return (
      <div className="ob-step">
        <h2 className="ob-step-title">Set your daily goals</h2>
        <p className="ob-step-sub">Complete body stats in Step 2 for auto-calculated goals, or enter manually below.</p>
        <div className="ob-goals-grid">
          <GoalField label="Calories" unit="kcal" color="coral" value={data.calorieGoal} onChange={v => set('calorieGoal', v)} placeholder="2000" />
          <GoalField label="Protein"  unit="g"    color="teal"  value={data.proteinGoal} onChange={v => set('proteinGoal', v)} placeholder="150"  />
          <GoalField label="Carbs"    unit="g"    color="amber" value={data.carbGoal}    onChange={v => set('carbGoal', v)}    placeholder="200"  />
          <GoalField label="Fat"      unit="g"    color="blue"  value={data.fatGoal}     onChange={v => set('fatGoal', v)}     placeholder="65"   />
        </div>
        <p className="ob-goals-hint">💡 You can update these anytime in your Profile.</p>
      </div>
    )
  }

  return (
    <div className="ob-step">
      <h2 className="ob-step-title">Your personalised goals</h2>
      <p className="ob-step-sub">Based on your stats, here's your TDEE. Pick a goal and we'll suggest your daily targets.</p>

      {/* TDEE pill */}
      <div className="ob-tdee-pill">
        <div className="ob-tdee-pill-left">
          <Flame size={16} className="ob-tdee-icon" />
          <span className="ob-tdee-label">Your daily TDEE</span>
        </div>
        <span className="ob-tdee-value">{tdee} kcal/day</span>
      </div>

      {/* Goal type selector */}
      <label className="ob-body-label" style={{ marginTop: '0.25rem' }}>What's your goal?</label>
      <div className="ob-goal-type-grid">
        {GOAL_TYPE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            className={`ob-goal-type-card ${data.weightGoal === opt.value ? 'ob-goal-type-card--active' : ''}`}
            onClick={() => pickGoal(opt.value)}
          >
            <span className="ob-goal-type-emoji">{opt.emoji}</span>
            <span className="ob-goal-type-label">{opt.label}</span>
            <span className="ob-goal-type-desc">{opt.desc}</span>
            <span className="ob-goal-type-kcal">
              {opt.delta === 0 ? `${tdee}` : opt.delta > 0 ? `${tdee! + opt.delta}` : `${Math.max(1200, tdee! + opt.delta)}`} kcal
            </span>
          </button>
        ))}
      </div>

      {/* Editable suggested macros */}
      {data.weightGoal !== '' && (
        <>
          <p className="ob-goals-hint" style={{ marginTop: '0.75rem' }}>
            ✏️ Tweak the numbers if you'd like — or just hit Continue to accept them.
          </p>
          <div className="ob-goals-grid">
            <GoalField label="Calories" unit="kcal" color="coral" value={data.calorieGoal} onChange={v => set('calorieGoal', v)} placeholder="2000" />
            <GoalField label="Protein"  unit="g"    color="teal"  value={data.proteinGoal} onChange={v => set('proteinGoal', v)} placeholder="150"  />
            <GoalField label="Carbs"    unit="g"    color="amber" value={data.carbGoal}    onChange={v => set('carbGoal', v)}    placeholder="200"  />
            <GoalField label="Fat"      unit="g"    color="blue"  value={data.fatGoal}     onChange={v => set('fatGoal', v)}     placeholder="65"   />
          </div>
        </>
      )}
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

// ── Step 4: Preferences ───────────────────

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
