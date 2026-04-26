'use client'

import { useQuery } from '@tanstack/react-query'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, TrendingUp, TrendingDown, ChefHat,
  Calendar, Flame, Beef, Wheat, Droplets,
  ArrowRight, RefreshCw,
  Target, Award
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import { useAuthStore } from '@/store/auth.store'
import { healthApi } from '@/services/health.service'
import { mealPlanApi } from '@/services/meal-plan.service'
import type { WeekDay } from '@/services/meal-plan.service'
import { aiApi } from '@/services/ai.service'
import { profileApi } from '@/services/profile.service'
import Link from 'next/link'
import './dashboard.css'

// ── Animation variants ───────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const },
  }),
}

// ── Fallback insight shown on first visit / API error ──
const FALLBACK_INSIGHT = {
  overview: "Eating consistent meals at regular intervals helps stabilise blood sugar and reduces the urge to snack on processed foods. Building a routine around meal timing is one of the most underrated nutrition habits.",
  recommendations: [
    "Aim for 25–30 g of protein per meal to support muscle maintenance and satiety.",
    "Drink a glass of water before each meal — mild dehydration often mimics hunger.",
    "Prep tomorrow's meals tonight so healthy choices are effortless on busy days.",
  ],
  motivationalMessage: "Every nutritious choice you make today is an investment in the energy and vitality you'll feel tomorrow.",
}

const MAX_DAILY_REFRESHES = 3

export default function DashboardPage() {
  const { user } = useAuthStore()
  const today = new Date()
  const greeting = getGreeting()
  const todayDateStr = today.toISOString().split('T')[0]

  // ── Insight state ────────────────────────
  const [insight, setInsight] = useState<any>(null)
  const [insightLoading, setInsightLoading] = useState(false)
  const [insightRefreshCount, setInsightRefreshCount] = useState(0)
  const insightFetchedRef = useRef(false)

  const insightCacheKey = `dash_insight_${user?.id ?? 'guest'}_${todayDateStr}`
  const insightCountKey  = `dash_insight_refreshes_${user?.id ?? 'guest'}_${todayDateStr}`

  // ── Server queries ───────────────────────
  const { data: weightData, isLoading: weightLoading } = useQuery({
    queryKey: ['weight-logs'],
    queryFn: () => healthApi.getWeightLogs({ limit: 30 }),
    staleTime: 3 * 60 * 1000, // weight changes rarely mid-session
  })

  const { data: nutritionData, isLoading: nutritionLoading } = useQuery({
    queryKey: ['nutrition-today'],
    queryFn: () => healthApi.getNutritionLogs({ limit: 7 }),
    staleTime: 90 * 1000, // nutrition logs updated frequently — 90s
  })

  const { data: weekView, isLoading: weekLoading, isError: weekError } = useQuery({
    queryKey: ['meal-plan-week'],
    queryFn: () => mealPlanApi.getWeekView(),
    staleTime: 3 * 60 * 1000,
  })

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: profileApi.getProfile,
    staleTime: 5 * 60 * 1000, // profile rarely changes
  })

  const isLoading = weightLoading || nutritionLoading || weekLoading || profileLoading

  // ── Auto-load insight on mount ───────────
  useEffect(() => {
    if (insightFetchedRef.current) return
    insightFetchedRef.current = true

    const cached = localStorage.getItem(insightCacheKey)
    const count  = parseInt(localStorage.getItem(insightCountKey) ?? '0', 10)
    setInsightRefreshCount(count)

    if (cached) {
      try { setInsight(JSON.parse(cached)) } catch { setInsight(FALLBACK_INSIGHT) }
    } else {
      // First visit today — auto-fetch once (does not count toward limit)
      setInsightLoading(true)
      aiApi.generateHealthInsights()
        .then((result) => {
          setInsight(result)
          localStorage.setItem(insightCacheKey, JSON.stringify(result))
        })
        .catch(() => {
          setInsight(FALLBACK_INSIGHT)
          localStorage.setItem(insightCacheKey, JSON.stringify(FALLBACK_INSIGHT))
        })
        .finally(() => setInsightLoading(false))
    }
  }, [insightCacheKey, insightCountKey])

  function handleRefreshInsight() {
    if (insightLoading || insightRefreshCount >= MAX_DAILY_REFRESHES) return
    setInsightLoading(true)
    aiApi.generateHealthInsights()
      .then((result) => {
        setInsight(result)
        localStorage.setItem(insightCacheKey, JSON.stringify(result))
        const next = insightRefreshCount + 1
        setInsightRefreshCount(next)
        localStorage.setItem(insightCountKey, String(next))
      })
      .catch(() => { /* keep current insight */ })
      .finally(() => setInsightLoading(false))
  }

  // ── Derived values ───────────────────────
  const todayNutrition = nutritionData?.today ?? null
  const calorieGoal = profile?.calorieGoal ?? 2000
  const proteinGoal = profile?.proteinGoal ?? 150
  const carbGoal    = profile?.carbGoal    ?? 200
  const fatGoal     = profile?.fatGoal     ?? 65
  const hasCustomGoals = !!(profile?.calorieGoal || profile?.proteinGoal || profile?.carbGoal || profile?.fatGoal)

  const todayMeals = weekView?.days?.find(
    (d) => d.date === todayDateStr
  )

  if (isLoading) {
    return (
      <div className="dash-root">
        <div className="dash-skeleton-header" />
        <div className="dash-skeleton-grid">
          {[1,2,3,4].map(i => <div key={i} className="dash-skeleton-card" />)}
        </div>
        <div className="dash-skeleton-grid dash-skeleton-grid--2">
          {[1,2].map(i => <div key={i} className="dash-skeleton-card dash-skeleton-card--tall" />)}
        </div>
      </div>
    )
  }

  if (weekError) {
    return (
      <div className="dash-root">
        <div className="dash-error">
          <Target size={32} />
          <h2>Couldn't load your dashboard</h2>
          <p>Check your connection and refresh the page.</p>
        </div>
      </div>
    )
  }

  const todayStr  = today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = user?.name?.split(' ')[0] ?? 'Chef'
  const refreshesLeft = MAX_DAILY_REFRESHES - insightRefreshCount

  return (
    <div className="dash-root">
      {/* ── Hero card ── */}
      <motion.div
        className="dash-hero"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="dash-hero-left">
          <p className="dash-hero-greeting">{greeting},</p>
          <h1 className="dash-hero-name">{firstName} 👋</h1>
          <p className="dash-hero-date">
            <Calendar size={13} />
            {todayStr}
          </p>
        </div>
        <div className="dash-hero-right">
          {/* Calorie progress ring — hero version */}
          <div className="dash-hero-ring">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="38" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
              <circle
                cx="48" cy="48" r="38" fill="none"
                stroke="white"
                strokeWidth="6"
                strokeDasharray={`${Math.min(100,(calorieGoal > 0 ? ((todayNutrition?.calories ?? 0) / calorieGoal) * 100 : 0))/100 * 2 * Math.PI * 38} ${2 * Math.PI * 38}`}
                strokeLinecap="round"
                transform="rotate(-90 48 48)"
              />
            </svg>
            <div className="dash-hero-ring-center">
              <span className="dash-hero-ring-val">{todayNutrition?.calories ?? 0}</span>
              <span className="dash-hero-ring-unit">kcal</span>
            </div>
          </div>
          <p className="dash-hero-ring-label">Today's calories</p>
        </div>
        <div className="dash-hero-decoration" />
      </motion.div>

      {/* ── Main grid ── */}
      <div className="dash-grid">

        {/* ── Nutrition ring cards ── */}
        <motion.section
          className="nutrition-section"
          custom={0} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <div className="section-label-row">
            <SectionLabel icon={<Flame size={14} />} label="Today's nutrition" />
            {!hasCustomGoals && (
              <Link href="/profile" className="set-goals-link">
                Set your goals →
              </Link>
            )}
          </div>
          <div className="nutrition-cards">
            <NutritionRing label="Calories" value={todayNutrition?.calories ?? 0} goal={calorieGoal} unit="kcal" color="coral" icon={<Flame    size={22} />} />
            <NutritionRing label="Protein"  value={todayNutrition?.protein  ?? 0} goal={proteinGoal} unit="g"    color="teal"  icon={<Beef     size={22} />} />
            <NutritionRing label="Carbs"    value={todayNutrition?.carbs    ?? 0} goal={carbGoal}    unit="g"    color="amber" icon={<Wheat    size={22} />} />
            <NutritionRing label="Fat"      value={todayNutrition?.fat      ?? 0} goal={fatGoal}     unit="g"    color="blue"  icon={<Droplets size={22} />} />
          </div>
        </motion.section>

        {/* ── Weight trend chart ── */}
        <motion.section
          className="weight-section card"
          custom={1} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <div className="card-header">
            <SectionLabel icon={<TrendingUp size={14} />} label="Weight trend" />
            <WeightStats stats={weightData?.stats} />
          </div>
          <WeightChart logs={weightData?.logs ?? []} />
        </motion.section>

        {/* ── Today's meals ── */}
        <motion.section
          className="meals-section card"
          custom={2} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <div className="card-header">
            <SectionLabel icon={<ChefHat size={14} />} label="Today's meals" />
            <a href="/weekly-planner" className="card-link">
              View planner <ArrowRight size={12} />
            </a>
          </div>
          <TodayMeals meals={todayMeals} />
        </motion.section>

        {/* ── AI Health Insights ── */}
        <motion.section
          className="insights-section card"
          custom={3} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <div className="card-header">
            <SectionLabel icon={<Sparkles size={14} />} label="AI health insight" />
            <button
              className="refresh-btn"
              onClick={handleRefreshInsight}
              disabled={insightLoading || insightRefreshCount >= MAX_DAILY_REFRESHES}
              title={insightRefreshCount >= MAX_DAILY_REFRESHES ? 'Daily refresh limit reached' : `${refreshesLeft} refresh${refreshesLeft !== 1 ? 'es' : ''} left today`}
            >
              <RefreshCw size={13} className={insightLoading ? 'spin' : ''} />
              {insightLoading
                ? 'Analysing...'
                : insightRefreshCount >= MAX_DAILY_REFRESHES
                  ? 'Limit reached'
                  : 'Refresh'}
            </button>
          </div>
          <HealthInsights insight={insight} loading={insightLoading} />
        </motion.section>

        {/* ── Quick actions ── */}
        <motion.section
          className="actions-section card"
          custom={4} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <SectionLabel icon={<Target size={14} />} label="Quick actions" />
          <div className="quick-actions">
            <QuickAction
              icon="🍳"
              label="Generate recipe"
              desc="AI-powered"
              href="/recipes"
              color="teal"
            />
            <QuickAction
              icon="📅"
              label="Plan this week"
              desc="AI meal planner"
              href="/weekly-planner"
              color="coral"
            />
            <QuickAction
              icon="🛒"
              label="Grocery list"
              desc="From meal plan"
              href="/groceries"
              color="amber"
            />
            <QuickAction
              icon="🥗"
              label="Pantry ideas"
              desc="Use what you have"
              href="/pantry"
              color="blue"
            />
          </div>
        </motion.section>

      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="section-label">
      <span className="section-icon-badge">{icon}</span>
      <span>{label}</span>
    </div>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) => Math.round(v))
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: 'easeOut' as const })
    const unsub = rounded.on('change', setDisplay)
    return () => { controls.stop(); unsub() }
  }, [value, mv, rounded])

  return <>{display}</>
}

function NutritionRing({
  label, value, goal, unit, color, icon,
}: {
  label: string; value: number; goal: number; unit: string; color: string; icon: React.ReactNode
}) {
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0)

  return (
    <motion.div
      className={`nutrition-card nutrition-${color}`}
      whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
      transition={{ duration: 0.2 }}
    >
      <div className="nc-body">
        <div className="nc-badge">{icon}</div>
        <div className="nc-info">
          <div className="nc-value-row">
            <span className="nc-value"><AnimatedNumber value={value} /></span>
            <span className="nc-unit">{unit}</span>
          </div>
          <span className="nc-secondary">of {goal} {unit}</span>
          <span className="nc-label">{label}</span>
        </div>
      </div>
      <div className="nc-bar-track">
        <motion.div
          className="nc-bar-fill"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' as const }}
        />
      </div>
    </motion.div>
  )
}

interface WeightStatsData { current?: number | null; totalChange?: number | null }

function WeightStats({ stats }: { stats: WeightStatsData | undefined }) {
  if (!stats?.current) return <span className="no-data-badge">No data yet</span>

  const change = stats.totalChange ?? 0
  const isDown = change <= 0

  return (
    <div className="weight-stats">
      <span className="weight-current">{stats.current}kg</span>
      <span className={`weight-change ${isDown ? 'change-down' : 'change-up'}`}>
        {isDown ? <TrendingDown size={12} /> : <TrendingUp size={12} />}
        {Math.abs(change)}kg
      </span>
    </div>
  )
}

interface WeightLog { logDate: string; weightKg: number }

function WeightChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="empty-state">
        <TrendingUp size={32} strokeWidth={1} />
        <p>Start logging your weight to see your trend</p>
        <a href="/progress" className="empty-cta">Log weight →</a>
      </div>
    )
  }

  const data = logs.map((l) => ({
    date: new Date(l.logDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    weight: l.weightKg,
  }))

  return (
    <div className="chart-wrap">
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1d9e75" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#1d9e75" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8880' }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#8a8880' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              background: 'white',
              border: '1px solid #e4e0d8',
              borderRadius: '10px',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
            formatter={(v) => [`${v}kg`, 'Weight']}
          />
          <Area type="monotone" dataKey="weight" stroke="#1d9e75" strokeWidth={2} fill="url(#weightGrad)" dot={false} activeDot={{ r: 4, fill: '#1d9e75' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function TodayMeals({ meals }: { meals: WeekDay | null | undefined }) {
  const slots: { key: 'breakfast' | 'lunch' | 'dinner' | 'snack'; label: string; icon: string }[] = [
    { key: 'breakfast', label: 'Breakfast', icon: '🌅' },
    { key: 'lunch', label: 'Lunch', icon: '☀️' },
    { key: 'dinner', label: 'Dinner', icon: '🌙' },
    { key: 'snack', label: 'Snack', icon: '🍎' },
  ]

  if (!meals) {
    return (
      <div className="empty-state">
        <Calendar size={32} strokeWidth={1} />
        <p>No meals planned for today</p>
        <a href="/weekly-planner" className="empty-cta">Plan your week →</a>
      </div>
    )
  }

  return (
    <div className="today-meals">
      {slots.map((slot) => {
        const meal = meals[slot.key]
        return (
          <div key={slot.key} className={`meal-slot ${meal ? 'meal-filled' : 'meal-empty'}`}>
            <span className="meal-icon">{slot.icon}</span>
            <div className="meal-info">
              <span className="meal-type">{slot.label}</span>
              <span className="meal-name">
                {meal
                  ? meal.recipe?.title ?? meal.customMealName ?? 'Custom meal'
                  : 'Not planned'}
              </span>
            </div>
            {meal?.recipe?.calories && (
              <span className="meal-cals">{meal.recipe.calories} kcal</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface HealthInsightData {
  overview: string
  recommendations?: string[]
  motivationalMessage?: string
}

function HealthInsights({ insight, loading }: { insight: HealthInsightData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="insights-loading">
        <div className="ai-pulse">
          <Sparkles size={24} />
        </div>
        <p>Generating your daily insight...</p>
      </div>
    )
  }

  if (!insight) {
    return (
      <div className="insights-empty">
        <div className="insights-empty-icon">
          <Sparkles size={28} strokeWidth={1.5} />
        </div>
        <p>Your personalised insight is loading.</p>
        <p className="insights-hint">This auto-generates once per day.</p>
      </div>
    )
  }

  return (
    <div className="insights-content">
      <p className="insights-overview">{insight.overview}</p>

      {(insight.recommendations?.length ?? 0) > 0 && (
        <div className="insights-recommendations">
          {insight.recommendations!.slice(0, 3).map((rec: string, i: number) => (
            <div key={i} className="rec-item">
              <Award size={12} />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      )}

      {insight.motivationalMessage && (
        <div className="insights-motivation">
          <span className="motivation-icon">✨</span>
          <p>{insight.motivationalMessage}</p>
        </div>
      )}
    </div>
  )
}

function QuickAction({
  icon, label, desc, href, color,
}: {
  icon: string; label: string; desc: string; href: string; color: string
}) {
  return (
    <motion.a
      href={href}
      className={`quick-action quick-action-${color}`}
      whileHover={{ y: -3, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      <span className="qa-icon">{icon}</span>
      <span className="qa-label">{label}</span>
      <span className="qa-desc">{desc}</span>
    </motion.a>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}
