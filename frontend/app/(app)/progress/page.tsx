'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Scale, Flame, X, Check, RefreshCw, Calendar,
  Target, ArrowUp, ArrowDown, Minus, Plus, Sparkles,
} from 'lucide-react'
import {
  AreaChart, Area, ComposedChart, Bar, Line, Legend,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'
import { healthApi, type WeightLog, type NutritionLog } from '@/services/health.service'
import { profileApi } from '@/services/profile.service'
import { aiApi, type HealthInsights } from '@/services/ai.service'
import { useAuthStore } from '@/store/auth.store'
import './progress.css'

// ── Types ────────────────────────────────
interface TooltipEntry {
  value: number
  dataKey: string
  name: string
  color: string
}

type HeatmapStatus = 'logged' | 'missed' | 'today' | 'future'

// ── Constants ────────────────────────────
const MAX_REFRESHES = 3

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  SEDENTARY: 1.2, LIGHT: 1.375, MODERATE: 1.55, ACTIVE: 1.725, VERY_ACTIVE: 1.9,
}

const ACTIVITY_LABELS: Record<string, string> = {
  SEDENTARY: 'Sedentary', LIGHT: 'Lightly active', MODERATE: 'Moderately active',
  ACTIVE: 'Very active', VERY_ACTIVE: 'Extra active',
}

const FALLBACK_INSIGHT: HealthInsights = {
  overview:
    'Consistency is the cornerstone of any successful health journey. Logging your weight and meals regularly — even on days things don\'t go perfectly — gives you the data to make informed adjustments.',
  recommendations: [
    'Aim to log your weight at the same time each morning for the most accurate trends.',
    'Even a rough nutrition estimate is better than no log — build the habit first.',
  ],
  motivationalMessage:
    'Every entry you make is a data point that tells your body\'s story. Keep showing up.',
}

// ── Pure helpers ─────────────────────────
function calcBMI(weightKg: number, heightCm: number): number {
  return weightKg / Math.pow(heightCm / 100, 2)
}

function bmiCategory(bmi: number): { label: string; color: 'teal' | 'amber' | 'coral' | 'blue' } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'blue' }
  if (bmi < 25)   return { label: 'Normal',      color: 'teal' }
  if (bmi < 30)   return { label: 'Overweight',  color: 'amber' }
  return               { label: 'Obese',         color: 'coral' }
}

function calcTDEE(
  weightKg: number, heightCm: number, age: number,
  gender: string | null, activityLevel: string,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  const bmr  = gender === 'MALE' ? base + 5 : gender === 'FEMALE' ? base - 161 : base - 78
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55))
}

function calcStreak(sortedAscLogs: WeightLog[]): number {
  if (sortedAscLogs.length === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const loggedTimes = new Set(
    sortedAscLogs.map(l => {
      const d = new Date(l.logDate)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }),
  )
  let streak = 0
  const cur = new Date(today)
  while (loggedTimes.has(cur.getTime())) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

function buildHeatmap(logDates: string[], days = 14): HeatmapStatus[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const logged = new Set(
    logDates.map(d => {
      const dt = new Date(d)
      dt.setHours(0, 0, 0, 0)
      return dt.getTime()
    }),
  )
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (days - 1 - i))
    if (d.getTime() === today.getTime()) return 'today'
    if (logged.has(d.getTime()))         return 'logged'
    return 'missed'
  })
}

// ── Sub-components ────────────────────────

function WeightTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipEntry[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="pg-tooltip">
      <p className="pg-tooltip-label">{label}</p>
      <p className="pg-tooltip-val">{payload[0].value} kg</p>
    </div>
  )
}

function NutritionTooltip({ active, payload, label }: {
  active?: boolean; payload?: TooltipEntry[]; label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="pg-tooltip">
      <p className="pg-tooltip-label">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="pg-tooltip-val">
          {p.name}: {p.value}{p.dataKey === 'calories' ? ' kcal' : 'g'}
        </p>
      ))}
    </div>
  )
}

// Arc ring — animated SVG circle showing goal progress
function ArcRing({ pct }: { pct: number }) {
  const R = 52
  const C = 2 * Math.PI * R
  const clamped = Math.min(100, Math.max(0, pct))
  const offset  = C * (1 - clamped / 100)
  return (
    <div className="pg-arc-ring">
      <svg width="128" height="128" viewBox="0 0 128 128" aria-hidden="true">
        <defs>
          <linearGradient id="pg-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%"   stopColor="var(--teal-200)" />
            <stop offset="100%" stopColor="var(--teal-600)" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle cx="64" cy="64" r={R} fill="none" stroke="var(--sand-200)" strokeWidth="10" />
        {/* Animated fill — rotated via wrapping <g> for reliable cross-browser SVG transform */}
        <g transform="rotate(-90 64 64)">
          <motion.circle
            cx="64" cy="64" r={R}
            fill="none"
            stroke="url(#pg-arc-grad)"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.1, ease: 'easeOut', delay: 0.35 }}
          />
        </g>
      </svg>
      <div className="pg-arc-center">
        <motion.span
          className="pg-arc-pct"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          {clamped}%
        </motion.span>
        <span className="pg-arc-sub">of goal</span>
      </div>
    </div>
  )
}

// Donut ring — animated SVG for a single macro
function DonutRing({ value, goal, color, label, unit, delay = 0 }: {
  value: number; goal: number; color: string
  label: string; unit: string; delay?: number
}) {
  const R = 30
  const C = 2 * Math.PI * R
  const pct    = goal > 0 ? Math.min(1, value / goal) : 0
  const offset = C * (1 - pct)
  return (
    <div className="pg-donut-wrap">
      <div className="pg-donut">
        <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true">
          <circle cx="38" cy="38" r={R} fill="none" stroke="var(--sand-200)" strokeWidth="8" />
          <g transform="rotate(-90 38 38)">
            <motion.circle
              cx="38" cy="38" r={R}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.85, ease: 'easeOut', delay: 0.5 + delay }}
            />
          </g>
        </svg>
        <div className="pg-donut-center">
          <span className="pg-donut-val">{value}</span>
          <span className="pg-donut-unit">{unit}</span>
        </div>
      </div>
      <span className="pg-donut-label">{label}</span>
      <span className="pg-donut-goal">Goal: {goal}{unit}</span>
    </div>
  )
}

// Deep-link handler — isolated in Suspense so useSearchParams doesn't block the page
function DeepLinkHandler({
  onWeightLog,
  onNutritionLog,
}: {
  onWeightLog: () => void
  onNutritionLog: () => void
}) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const open = searchParams.get('open')
    if (open === 'weight-log')    onWeightLog()
    if (open === 'nutrition-log') onNutritionLog()
  }, [searchParams, onWeightLog, onNutritionLog])
  return null
}

// ── Page ─────────────────────────────────
function ProgressPageInner() {
  const { user }       = useAuthStore()
  const queryClient    = useQueryClient()

  const [showWeightModal,    setShowWeightModal]    = useState(false)
  const [showNutritionModal, setShowNutritionModal] = useState(false)
  const [toast,    setToast]    = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [weightRange, setWeightRange] = useState<7 | 30 | 90>(30)
  const [insight,        setInsight]        = useState<HealthInsights | null>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightRefreshCount, setInsightRefreshCount] = useState(0)

  // Refs for memory-leak prevention
  const mountedRef       = useRef(true)
  const insightFetchedRef = useRef(false)

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  const todayDateStr    = new Date().toISOString().split('T')[0]
  const insightCacheKey = `prog_insight_${user?.id ?? 'guest'}_${todayDateStr}`
  const insightCountKey = `prog_insight_refreshes_${user?.id ?? 'guest'}_${todayDateStr}`

  // ── Toast helper ─────────────────────────
  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (!mountedRef.current) return
    setToast({ msg, type })
    const t = setTimeout(() => {
      if (mountedRef.current) setToast(null)
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  // ── Queries ──────────────────────────────
  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn:  profileApi.getProfile,
    staleTime: 5 * 60 * 1000,
  })

  const { data: weightData, isLoading: weightLoading } = useQuery({
    queryKey: ['weight-logs-full'],
    queryFn:  () => healthApi.getWeightLogs({ limit: 60 }),
    staleTime: 3 * 60 * 1000,
  })

  const { data: nutritionData, isLoading: nutritionLoading } = useQuery({
    queryKey: ['nutrition-logs-full'],
    queryFn:  () => healthApi.getNutritionLogs({ limit: 14 }),
    staleTime: 2 * 60 * 1000,
  })

  // ── AI insight — auto-fetch once per day, cache in localStorage ────────────
  useEffect(() => {
    if (insightFetchedRef.current) return
    insightFetchedRef.current = true

    const cached = localStorage.getItem(insightCacheKey)
    const count  = parseInt(localStorage.getItem(insightCountKey) ?? '0', 10)
    if (mountedRef.current) setInsightRefreshCount(count)

    if (cached) {
      try {
        if (mountedRef.current) setInsight(JSON.parse(cached) as HealthInsights)
      } catch {
        if (mountedRef.current) setInsight(FALLBACK_INSIGHT)
      }
      return
    }

    if (mountedRef.current) setInsightLoading(true)
    aiApi
      .generateHealthInsights()
      .then(result => {
        if (!mountedRef.current) return
        setInsight(result)
        localStorage.setItem(insightCacheKey, JSON.stringify(result))
      })
      .catch(() => {
        if (!mountedRef.current) return
        setInsight(FALLBACK_INSIGHT)
      })
      .finally(() => {
        if (mountedRef.current) setInsightLoading(false)
      })
  }, [insightCacheKey, insightCountKey])

  const handleRefreshInsight = useCallback(() => {
    if (insightLoading || insightRefreshCount >= MAX_REFRESHES) return
    if (mountedRef.current) setInsightLoading(true)
    aiApi
      .generateHealthInsights()
      .then(result => {
        if (!mountedRef.current) return
        setInsight(result)
        localStorage.setItem(insightCacheKey, JSON.stringify(result))
        const next = insightRefreshCount + 1
        setInsightRefreshCount(next)
        localStorage.setItem(insightCountKey, String(next))
      })
      .catch(() => { /* keep current insight on error */ })
      .finally(() => {
        if (mountedRef.current) setInsightLoading(false)
      })
  }, [insightLoading, insightRefreshCount, insightCacheKey, insightCountKey])

  // ── Mutations ────────────────────────────
  const addWeightMutation = useMutation({
    mutationFn: (payload: { weightKg: number; logDate: string; notes?: string }) =>
      healthApi.addWeightLog(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-logs-full'] })
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (err: Error) => showToast(err.message || 'Failed to log weight', 'error'),
  })

  const addNutritionMutation = useMutation({
    mutationFn: (payload: {
      calories: number; protein: number; carbs: number; fat: number; date: string
    }) => healthApi.addNutritionLog(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nutrition-logs-full'] })
      queryClient.invalidateQueries({ queryKey: ['nutrition-today'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
    onError: (err: Error) => showToast(err.message || 'Failed to log nutrition', 'error'),
  })

  // ── Derived values ───────────────────────
  const weightLogs: WeightLog[]       = weightData?.logs     ?? []
  const nutritionLogs: NutritionLog[] = nutritionData?.logs  ?? []
  const todayNutrition                = nutritionData?.today  ?? null

  const calorieGoal = profile?.calorieGoal ?? 2000
  const proteinGoal = profile?.proteinGoal ?? 150
  const carbGoal    = profile?.carbGoal    ?? 200
  const fatGoal     = profile?.fatGoal     ?? 65

  const profileWeight = profile?.weightKg        ?? null
  const profileHeight = profile?.heightCm        ?? null
  const targetWeight  = profile?.targetWeightKg  ?? null

  const currentWeight = weightData?.stats?.current ?? profileWeight

  const bmi     = currentWeight && profileHeight
    ? parseFloat(calcBMI(currentWeight, profileHeight).toFixed(1))
    : null
  const bmiInfo = bmi ? bmiCategory(bmi) : null

  const tdee = currentWeight && profileHeight && profile?.age && profile?.activityLevel
    ? calcTDEE(currentWeight, profileHeight, profile.age, profile.gender ?? null, profile.activityLevel)
    : null
  const tdeeLabel = profile?.activityLevel ? ACTIVITY_LABELS[profile.activityLevel] : null

  const sortedWeightLogs = [...weightLogs].sort(
    (a, b) => new Date(a.logDate).getTime() - new Date(b.logDate).getTime(),
  )

  const startWeight = sortedWeightLogs.length > 0
    ? sortedWeightLogs[0].weightKg
    : profileWeight

  const goalProgress = (() => {
    if (startWeight == null || currentWeight == null || targetWeight == null) return null
    const total    = Math.abs(startWeight - targetWeight)
    if (total === 0) return 100
    const achieved = Math.abs(startWeight - currentWeight)
    return Math.min(100, Math.max(0, Math.round((achieved / total) * 100)))
  })()

  const kgToGoal = currentWeight != null && targetWeight != null
    ? parseFloat(Math.abs(currentWeight - targetWeight).toFixed(1))
    : null

  const weightStreak    = calcStreak(sortedWeightLogs)
  const weightHeatmap   = buildHeatmap(sortedWeightLogs.map(l => l.logDate))
  const nutritionHeatmap = buildHeatmap(nutritionLogs.map(l => l.date))

  const cutoffMs        = Date.now() - weightRange * 24 * 60 * 60 * 1000
  const weightChartData = sortedWeightLogs
    .filter(l => new Date(l.logDate).getTime() >= cutoffMs)
    .map(l => ({
      date:   new Date(l.logDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      weight: l.weightKg,
    }))

  const nutritionChartData = [...nutritionLogs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-14)
    .map(l => ({
      date:     new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      calories: l.calories,
      protein:  l.protein,
      carbs:    l.carbs,
      fat:      l.fat,
    }))

  const showWeightPrompt = weightLogs.length === 0 && profileWeight != null
  const isDataLoading    = weightLoading || nutritionLoading
  const refreshesLeft    = MAX_REFRESHES - insightRefreshCount

  // Stable callbacks for DeepLinkHandler (avoids effect re-running)
  const openWeightModal    = useCallback(() => setShowWeightModal(true),    [])
  const openNutritionModal = useCallback(() => setShowNutritionModal(true), [])

  // ── Render ───────────────────────────────
  return (
    <div className="pg-root">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`pg-toast pg-toast--${toast.type}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toast.type === 'success' ? <Check size={14} /> : <X size={14} />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header — no action buttons (moved into hero cards) */}
      <motion.header
        className="pg-header"
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="pg-eyebrow">Tracking</p>
        <h1 className="pg-title">My Progress</h1>
      </motion.header>

      {/* ── Hero Panel ── */}
      {isDataLoading ? (
        <div className="pg-hero-panel">
          <div className="pg-hero-skeleton" />
          <div className="pg-hero-skeleton" />
        </div>
      ) : (
        <motion.div
          className="pg-hero-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          {/* ── Weight Journey Card ── */}
          <div className="pg-weight-hero">
            <span className="pg-card-label">Weight Journey</span>

            <div className="pg-arc-section">
              {goalProgress != null ? (
                <ArcRing pct={goalProgress} />
              ) : (
                <div className="pg-arc-ring pg-arc-ring--empty">
                  <div className="pg-arc-center">
                    <Target size={28} strokeWidth={1.5} color="var(--txt3)" />
                  </div>
                </div>
              )}

              <div className="pg-weight-stats">
                <div>
                  <div className="pg-weight-label">Current weight</div>
                  {currentWeight != null ? (
                    <div className="pg-weight-big">
                      {currentWeight} <span className="pg-weight-unit">kg</span>
                    </div>
                  ) : (
                    <div className="pg-weight-big pg-weight-big--empty">—</div>
                  )}
                </div>

                {targetWeight != null && (
                  <div className="pg-weight-row">
                    <div>
                      <div className="pg-weight-label">Target</div>
                      <div className="pg-weight-target">{targetWeight} kg</div>
                    </div>
                    {kgToGoal != null && currentWeight !== targetWeight && (
                      <span className="pg-pill pg-pill--teal">▼ {kgToGoal} kg to go</span>
                    )}
                    {currentWeight === targetWeight && (
                      <span className="pg-pill pg-pill--teal">🎉 Goal reached!</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {bmi != null && bmiInfo && (
              <div className="pg-bmi-row">
                <span className="pg-bmi-label">BMI</span>
                <div className="pg-bmi-right">
                  <span className="pg-bmi-val">{bmi}</span>
                  <span className={`pg-pill pg-pill--${bmiInfo.color}`}>{bmiInfo.label}</span>
                </div>
              </div>
            )}

            {tdee != null && (
              <div className="pg-tdee-row">
                <span>Estimated daily burn (TDEE)</span>
                <strong>
                  {tdee.toLocaleString()} kcal
                  {tdeeLabel ? ` · ${tdeeLabel}` : ''}
                </strong>
              </div>
            )}

            <button
              className="pg-log-btn pg-log-btn--weight"
              onClick={() => setShowWeightModal(true)}
            >
              <Scale size={15} />
              Log weight
            </button>
          </div>

          {/* ── Today's Nutrition Card ── */}
          <div className="pg-nutrition-hero">
            <span className="pg-card-label">Today's Nutrition</span>

            {todayNutrition ? (
              <div className="pg-cal-summary">
                <div>
                  <div className="pg-cal-big">{todayNutrition.calories.toLocaleString()}</div>
                  <div className="pg-cal-sub">kcal logged today</div>
                </div>
                <div className="pg-cal-right">
                  {calorieGoal - todayNutrition.calories > 0 ? (
                    <div className="pg-cal-remaining">
                      {(calorieGoal - todayNutrition.calories).toLocaleString()} kcal remaining
                    </div>
                  ) : (
                    <div className="pg-cal-over">Goal exceeded</div>
                  )}
                  <div className="pg-cal-goal">Goal: {calorieGoal.toLocaleString()} kcal</div>
                </div>
              </div>
            ) : (
              <div className="pg-cal-empty">
                <Flame size={16} strokeWidth={1.5} />
                <span>No nutrition logged today</span>
              </div>
            )}

            <div className="pg-donut-row">
              <DonutRing
                label="Protein"
                value={todayNutrition?.protein ?? 0}
                goal={proteinGoal}
                color="var(--teal-400)"
                unit="g"
                delay={0}
              />
              <DonutRing
                label="Carbs"
                value={todayNutrition?.carbs ?? 0}
                goal={carbGoal}
                color="var(--amber-400)"
                unit="g"
                delay={0.1}
              />
              <DonutRing
                label="Fat"
                value={todayNutrition?.fat ?? 0}
                goal={fatGoal}
                color="var(--blue-400)"
                unit="g"
                delay={0.2}
              />
            </div>

            <button
              className="pg-log-btn pg-log-btn--nutrition"
              onClick={() => setShowNutritionModal(true)}
            >
              <Flame size={15} />
              Log nutrition
            </button>
          </div>
        </motion.div>
      )}

      {/* ── AI Health Insight Card ── */}
      <motion.div
        className="pg-ai-card"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.2 }}
      >
        <div className="pg-ai-icon">
          {insightLoading
            ? <RefreshCw size={20} className="pg-spin" />
            : <Sparkles size={20} />}
        </div>
        <div className="pg-ai-body">
          <div className="pg-ai-badge">✦ AI Health Insight</div>

          {insightLoading ? (
            <div className="pg-ai-loading">
              <div className="pg-ai-skeleton-line" />
              <div className="pg-ai-skeleton-line pg-ai-skeleton-line--short" />
            </div>
          ) : insight ? (
            <>
              <p className="pg-ai-text">{insight.overview}</p>
              {insight.recommendations?.slice(0, 2).map((rec, i) => (
                <p key={i} className="pg-ai-rec">· {rec}</p>
              ))}
              {insight.motivationalMessage && (
                <p className="pg-ai-motivational">"{insight.motivationalMessage}"</p>
              )}
            </>
          ) : null}

          <div className="pg-ai-footer">
            <button
              className="pg-ai-refresh"
              onClick={handleRefreshInsight}
              disabled={insightLoading || insightRefreshCount >= MAX_REFRESHES}
            >
              <RefreshCw size={12} />
              Refresh
            </button>
            <span className="pg-ai-refreshes">
              {refreshesLeft} refresh{refreshesLeft !== 1 ? 'es' : ''} remaining today
            </span>
          </div>
        </div>
      </motion.div>

      {/* ── Charts — both visible simultaneously, no tabs ── */}
      <motion.div
        className="pg-charts-row"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.3 }}
      >

        {/* Weight Trend Card */}
        <div className="pg-chart-card">
          <div className="pg-chart-header">
            <div>
              <h2 className="pg-chart-title">Weight Trend</h2>
              <span className="pg-chart-sub">{weightChartData.length} entr{weightChartData.length === 1 ? 'y' : 'ies'} in range</span>
            </div>
            <div className="pg-range-toggle">
              {([7, 30, 90] as const).map(r => (
                <button
                  key={r}
                  className={`pg-range-btn${weightRange === r ? ' pg-range-btn--active' : ''}`}
                  onClick={() => setWeightRange(r)}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>

          {sortedWeightLogs.length > 0 && (
            <>
              {weightStreak > 0 && (
                <div className="pg-streak-badge">🔥 {weightStreak}-day logging streak</div>
              )}
              <div className="pg-heatmap">
                <div className="pg-heatmap-label">Last 14 days</div>
                <div className="pg-heatmap-row">
                  {weightHeatmap.map((status, i) => (
                    <div
                      key={i}
                      className={`pg-heatmap-day pg-heatmap-day--${status}`}
                      title={status}
                      aria-label={status}
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {weightLoading ? (
            <div className="pg-chart-skeleton" />
          ) : showWeightPrompt ? (
            <div className="pg-weight-prompt">
              <div className="pg-weight-prompt-icon"><Scale size={24} /></div>
              <div>
                <p className="pg-weight-prompt-title">Log today's weight to start tracking</p>
                <p className="pg-weight-prompt-sub">
                  Your profile shows <strong>{profileWeight} kg</strong>. Confirm it as your starting point.
                </p>
              </div>
              <button className="pg-btn pg-btn--primary" onClick={() => setShowWeightModal(true)}>
                <Plus size={14} /> Log today
              </button>
            </div>
          ) : weightChartData.length === 0 ? (
            <div className="pg-chart-empty">
              <Scale size={28} />
              <p>No weight entries in this range</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weightChartData} margin={{ top: 8, right: 40, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="wGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#1d9e75" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#1d9e75" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d8" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8a8880' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8a8880' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                <Tooltip content={<WeightTooltip />} />
                {targetWeight && (
                  <ReferenceLine
                    y={targetWeight}
                    stroke="#d85a30"
                    strokeDasharray="4 4"
                    label={{ value: 'Goal', position: 'insideRight', fontSize: 10, fill: '#d85a30', dx: 4 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#1d9e75"
                  strokeWidth={2.5}
                  fill="url(#wGrad)"
                  dot={{ r: weightChartData.length === 1 ? 6 : 3, fill: '#1d9e75', strokeWidth: 2, stroke: 'white' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {sortedWeightLogs.length > 0 && (
            <div className="pg-timeline-wrap">
              <h3 className="pg-log-title">Recent entries</h3>
              <div className="pg-timeline">
                {[...sortedWeightLogs].slice(-6).reverse().map((log, i, arr) => {
                  const older = arr[i + 1]
                  const diff  = older ? log.weightKg - older.weightKg : null
                  return (
                    <div key={log.id} className="pg-timeline-item">
                      <div className={`pg-timeline-dot${i === 0 ? ' pg-timeline-dot--active' : ''}`} />
                      <span className="pg-timeline-date">
                        <Calendar size={12} />
                        {new Date(log.logDate).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                      <span className="pg-timeline-val">{log.weightKg} kg</span>
                      {diff != null && (
                        <span className={`pg-diff ${diff < 0 ? 'pg-diff--down' : diff > 0 ? 'pg-diff--up' : ''}`}>
                          {diff < 0
                            ? <ArrowDown size={11} />
                            : diff > 0
                            ? <ArrowUp size={11} />
                            : <Minus size={11} />}
                          {Math.abs(diff).toFixed(1)} kg
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Nutrition History Card */}
        <div className="pg-chart-card">
          <div className="pg-chart-header">
            <div>
              <h2 className="pg-chart-title">Nutrition History</h2>
              <span className="pg-chart-sub">Last 14 days</span>
            </div>
          </div>

          {nutritionLogs.length > 0 && (
            <div className="pg-heatmap">
              <div className="pg-heatmap-label">Days logged</div>
              <div className="pg-heatmap-row">
                {nutritionHeatmap.map((status, i) => (
                  <div
                    key={i}
                    className={`pg-heatmap-day pg-heatmap-day--${status}`}
                    title={status}
                    aria-label={status}
                  />
                ))}
              </div>
            </div>
          )}

          {nutritionLoading ? (
            <div className="pg-chart-skeleton" />
          ) : nutritionChartData.length === 0 ? (
            <div className="pg-chart-empty">
              <Flame size={28} />
              <p>No nutrition entries yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={nutritionChartData} margin={{ top: 8, right: 48, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d8" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#8a8880' }} tickLine={false} />
                <YAxis yAxisId="macros" tick={{ fontSize: 10, fill: '#8a8880' }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="cal" orientation="right" tick={{ fontSize: 10, fill: '#8a8880' }} tickLine={false} axisLine={false} />
                <Tooltip content={<NutritionTooltip />} />
                <Legend iconSize={9} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                <ReferenceLine
                  yAxisId="cal"
                  y={calorieGoal}
                  stroke="#d85a30"
                  strokeDasharray="4 4"
                  label={{ value: 'Cal goal', position: 'insideRight', fontSize: 9, fill: '#d85a30', dx: 4 }}
                />
                <Bar yAxisId="cal" dataKey="calories" name="Calories (kcal)"
                  fill="#1d9e75" fillOpacity={0.15} radius={[3, 3, 0, 0]} maxBarSize={32} />
                <Line yAxisId="macros" type="monotone" dataKey="protein" name="Protein (g)"
                  stroke="#1d9e75" strokeWidth={2} dot={{ r: 2.5, fill: '#1d9e75' }} activeDot={{ r: 4 }} />
                <Line yAxisId="macros" type="monotone" dataKey="carbs" name="Carbs (g)"
                  stroke="#ba7517" strokeWidth={2} dot={{ r: 2.5, fill: '#ba7517' }} activeDot={{ r: 4 }} />
                <Line yAxisId="macros" type="monotone" dataKey="fat" name="Fat (g)"
                  stroke="#378add" strokeWidth={2} dot={{ r: 2.5, fill: '#378add' }} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {nutritionLogs.length > 0 && (() => {
            const rows = [...nutritionLogs]
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 8)
            return (
              <div className="pg-nt-wrap">
                <h3 className="pg-log-title">Macro breakdown</h3>
                <div className="pg-table-scroll">
                  <table className="pg-nt-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Calories</th>
                        <th>Protein</th>
                        <th>Carbs</th>
                        <th>Fat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((log, i) => {
                        const prev = rows[i + 1]
                        return (
                          <tr key={log.id}>
                            <td className="pg-td-date">
                              {new Date(log.date).toLocaleDateString('en-GB', {
                                day: 'numeric', month: 'short',
                              })}
                            </td>
                            <td>
                              <span className="pg-td-cal">{log.calories}</span>
                              {prev && log.calories !== prev.calories && (
                                <span className={`pg-diff ${log.calories > prev.calories ? 'pg-diff--up' : 'pg-diff--down'}`}>
                                  {log.calories > prev.calories
                                    ? <ArrowUp size={9} />
                                    : <ArrowDown size={9} />}
                                  {Math.abs(log.calories - prev.calories)}
                                </span>
                              )}
                            </td>
                            <td>{log.protein}g</td>
                            <td>{log.carbs}g</td>
                            <td>{log.fat}g</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>

      </motion.div>

      {/* ── Log Weight Modal ── */}
      <AnimatePresence>
        {showWeightModal && (
          <LogWeightModal
            isLoading={addWeightMutation.isPending}
            isSuccess={addWeightMutation.isSuccess}
            initialWeight={showWeightPrompt ? profileWeight?.toString() : undefined}
            onClose={() => { setShowWeightModal(false); addWeightMutation.reset() }}
            onSubmit={payload => addWeightMutation.mutate(payload)}
            onSuccessDone={() => { setShowWeightModal(false); addWeightMutation.reset() }}
          />
        )}
      </AnimatePresence>

      {/* ── Log Nutrition Modal ── */}
      <AnimatePresence>
        {showNutritionModal && (
          <LogNutritionModal
            isLoading={addNutritionMutation.isPending}
            isSuccess={addNutritionMutation.isSuccess}
            goals={{ calories: calorieGoal, protein: proteinGoal, carbs: carbGoal, fat: fatGoal }}
            onClose={() => { setShowNutritionModal(false); addNutritionMutation.reset() }}
            onSubmit={payload => addNutritionMutation.mutate(payload)}
            onSuccessDone={() => { setShowNutritionModal(false); addNutritionMutation.reset() }}
          />
        )}
      </AnimatePresence>

      {/* Deep-link handler isolated in its own Suspense so useSearchParams doesn't block */}
      <Suspense fallback={null}>
        <DeepLinkHandler onWeightLog={openWeightModal} onNutritionLog={openNutritionModal} />
      </Suspense>
    </div>
  )
}

export default function ProgressPage() {
  return (
    <Suspense fallback={null}>
      <ProgressPageInner />
    </Suspense>
  )
}

// ── Log Weight Modal ──────────────────────────────────────────────────────────
function LogWeightModal({
  isLoading, isSuccess, initialWeight, onClose, onSubmit, onSuccessDone,
}: {
  isLoading: boolean
  isSuccess: boolean
  initialWeight?: string
  onClose: () => void
  onSubmit: (payload: { weightKg: number; logDate: string; notes?: string }) => void
  onSuccessDone: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [weight, setWeight] = useState(initialWeight ?? '')
  const [date,   setDate]   = useState(today)
  const [notes,  setNotes]  = useState('')

  useEffect(() => {
    if (!isSuccess) return
    const t = setTimeout(onSuccessDone, 900)
    return () => clearTimeout(t)
  }, [isSuccess, onSuccessDone])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!weight || !date) return
    onSubmit({ weightKg: Number(weight), logDate: date, notes: notes || undefined })
  }

  return (
    <div className="pg-overlay" onClick={onClose}>
      <motion.div
        className="pg-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{    opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
      >
        <div className="pg-modal-header">
          <h2>Log weight</h2>
          <button className="pg-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="pg-modal-form">
          <label className="pg-label">
            Weight (kg) *
            <input
              className="pg-input" type="number" step="0.1" min="0" placeholder="e.g. 75.5"
              value={weight} onChange={e => setWeight(e.target.value)}
              autoFocus disabled={isSuccess}
            />
          </label>
          <label className="pg-label">
            Date *
            <input
              className="pg-input" type="date" value={date} max={today}
              onChange={e => setDate(e.target.value)} disabled={isSuccess}
            />
          </label>
          <label className="pg-label">
            Notes
            <input
              className="pg-input" placeholder="Optional note..."
              value={notes} onChange={e => setNotes(e.target.value)} disabled={isSuccess}
            />
          </label>
          <div className="pg-modal-actions">
            <button type="button" className="pg-btn pg-btn--ghost" onClick={onClose} disabled={isSuccess}>
              Cancel
            </button>
            <button
              type="submit"
              className={`pg-btn ${isSuccess ? 'pg-btn--success' : 'pg-btn--primary'}`}
              disabled={isLoading || isSuccess || !weight || !date}
            >
              {isLoading ? <RefreshCw size={14} className="pg-spin" /> : <Check size={14} />}
              {isSuccess ? 'Logged!' : 'Save entry'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ── Log Nutrition Modal ───────────────────────────────────────────────────────
function LogNutritionModal({
  isLoading, isSuccess, goals, onClose, onSubmit, onSuccessDone,
}: {
  isLoading: boolean
  isSuccess: boolean
  goals: { calories: number; protein: number; carbs: number; fat: number }
  onClose: () => void
  onSubmit: (payload: { calories: number; protein: number; carbs: number; fat: number; date: string }) => void
  onSuccessDone: () => void
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({ calories: '', protein: '', carbs: '', fat: '', date: today })

  useEffect(() => {
    if (!isSuccess) return
    const t = setTimeout(onSuccessDone, 900)
    return () => clearTimeout(t)
  }, [isSuccess, onSuccessDone])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.calories) return
    onSubmit({
      calories: Number(form.calories),
      protein:  Number(form.protein)  || 0,
      carbs:    Number(form.carbs)    || 0,
      fat:      Number(form.fat)      || 0,
      date:     form.date,
    })
  }

  const macros = [
    { key: 'calories' as const, label: 'Calories', unit: 'kcal', placeholder: `Goal: ${goals.calories}` },
    { key: 'protein'  as const, label: 'Protein',  unit: 'g',    placeholder: `Goal: ${goals.protein}g` },
    { key: 'carbs'    as const, label: 'Carbs',    unit: 'g',    placeholder: `Goal: ${goals.carbs}g` },
    { key: 'fat'      as const, label: 'Fat',      unit: 'g',    placeholder: `Goal: ${goals.fat}g` },
  ]

  return (
    <div className="pg-overlay" onClick={onClose}>
      <motion.div
        className="pg-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1,    y: 0 }}
        exit={{    opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
      >
        <div className="pg-modal-header">
          <h2>Log nutrition</h2>
          <button className="pg-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="pg-modal-form">
          <label className="pg-label">
            Date *
            <input
              className="pg-input" type="date" value={form.date} max={today}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} disabled={isSuccess}
            />
          </label>
          <div className="pg-macros-grid">
            {macros.map(({ key, label, unit, placeholder }) => (
              <label key={key} className="pg-label">
                {label}
                <div className="pg-input-wrap">
                  <input
                    className="pg-input" type="number" min="0" step="any"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    autoFocus={key === 'calories'}
                    disabled={isSuccess}
                  />
                  <span className="pg-input-unit">{unit}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="pg-modal-actions">
            <button type="button" className="pg-btn pg-btn--ghost" onClick={onClose} disabled={isSuccess}>
              Cancel
            </button>
            <button
              type="submit"
              className={`pg-btn ${isSuccess ? 'pg-btn--success' : 'pg-btn--primary'}`}
              disabled={isLoading || isSuccess || !form.calories}
            >
              {isLoading ? <RefreshCw size={14} className="pg-spin" /> : <Check size={14} />}
              {isSuccess ? 'Logged!' : 'Save entry'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
