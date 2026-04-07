'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useState } from 'react'
import {
  Sparkles, TrendingUp, TrendingDown, ChefHat,
  Calendar, ShoppingCart, Apple, Flame,
  Beef, Wheat, Droplets, ArrowRight, RefreshCw,
  Target, Award
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import { useAuthStore } from '@/store/auth.store'
import { healthApi } from '@/services/health.service'
import { mealPlanApi } from '@/services/meal-plan.service'
import { aiApi } from '@/services/ai.service'
import './dashboard.css'

// ── Animation variants ───────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const today = new Date()
  const greeting = getGreeting()

  const { data: weightData } = useQuery({
    queryKey: ['weight-logs'],
    queryFn: () => healthApi.getWeightLogs({ limit: 30 }),
  })

  const { data: nutritionData } = useQuery({
    queryKey: ['nutrition-today'],
    queryFn: () => healthApi.getNutritionLogs({ limit: 7 }),
  })

  const { data: weekView } = useQuery({
    queryKey: ['meal-plan-week'],
    queryFn: () => mealPlanApi.getWeekView(),
  })

  const {
    data: insights,
    mutate: fetchInsights,
    isPending: insightsLoading,
  } = useMutation({
    mutationFn: () => aiApi.generateHealthInsights(),
  })

  const todayNutrition = nutritionData?.today
  const calorieGoal = user?.profile?.calorieGoal ?? 2000
  const proteinGoal = user?.profile?.proteinGoal ?? 150
  const carbGoal = user?.profile?.carbGoal ?? 200
  const fatGoal = user?.profile?.fatGoal ?? 65

  const todayMeals = weekView?.days?.find(
    (d) => d.date === today.toISOString().split('T')[0]
  )

  return (
    <div className="dash-root">
      {/* ── Header ── */}
      <motion.header
        className="dash-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <p className="dash-greeting">{greeting}</p>
          <h1 className="dash-name">{user?.name?.split(' ')[0] ?? 'Chef'} 👋</h1>
        </div>
        <div className="dash-date">
          <Calendar size={14} />
          <span>{today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </div>
      </motion.header>

      {/* ── Main grid ── */}
      <div className="dash-grid">

        {/* ── Nutrition ring cards ── */}
        <motion.section
          className="nutrition-section"
          custom={0} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <SectionLabel icon={<Flame size={14} />} label="Today's nutrition" />
          <div className="nutrition-cards">
            <NutritionRing
              label="Calories"
              value={todayNutrition?.calories ?? 0}
              goal={calorieGoal}
              unit="kcal"
              color="coral"
              icon={<Flame size={16} />}
            />
            <NutritionRing
              label="Protein"
              value={todayNutrition?.protein ?? 0}
              goal={proteinGoal}
              unit="g"
              color="teal"
              icon={<Beef size={16} />}
            />
            <NutritionRing
              label="Carbs"
              value={todayNutrition?.carbs ?? 0}
              goal={carbGoal}
              unit="g"
              color="amber"
              icon={<Wheat size={16} />}
            />
            <NutritionRing
              label="Fat"
              value={todayNutrition?.fat ?? 0}
              goal={fatGoal}
              unit="g"
              color="blue"
              icon={<Droplets size={16} />}
            />
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
            <SectionLabel icon={<Sparkles size={14} />} label="AI health insights" />
            <button
              className="refresh-btn"
              onClick={() => fetchInsights()}
              disabled={insightsLoading}
            >
              <RefreshCw size={13} className={insightsLoading ? 'spin' : ''} />
              {insightsLoading ? 'Analysing...' : 'Refresh'}
            </button>
          </div>
          <HealthInsights insights={insights} loading={insightsLoading} />
        </motion.section>

        {/* ── Quick actions ── */}
        <motion.section
          className="actions-section"
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
      {icon}
      <span>{label}</span>
    </div>
  )
}

function NutritionRing({
  label, value, goal, unit, color, icon,
}: {
  label: string; value: number; goal: number
  unit: string; color: string; icon: React.ReactNode
}) {
  const pct = Math.min(100, goal > 0 ? (value / goal) * 100 : 0)
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <div className={`nutrition-card nutrition-${color}`}>
      <div className="ring-wrap">
        <svg width="72" height="72" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" className="ring-track" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            className="ring-fill"
            strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            transform="rotate(-90 36 36)"
          />
        </svg>
        <div className="ring-center">
          {icon}
        </div>
      </div>
      <div className="nutrition-info">
        <span className="nutrition-value">{value}<span className="nutrition-unit">{unit}</span></span>
        <span className="nutrition-label">{label}</span>
        <span className="nutrition-goal">of {goal}{unit}</span>
      </div>
    </div>
  )
}

function WeightStats({ stats }: { stats: any }) {
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

function WeightChart({ logs }: { logs: any[] }) {
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
            formatter={(v: any) => [`${v}kg`, 'Weight']}
          />
          <Area type="monotone" dataKey="weight" stroke="#1d9e75" strokeWidth={2} fill="url(#weightGrad)" dot={false} activeDot={{ r: 4, fill: '#1d9e75' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function TodayMeals({ meals }: { meals: any }) {
  const slots = [
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

function HealthInsights({ insights, loading }: { insights: any; loading: boolean }) {
  if (loading) {
    return (
      <div className="insights-loading">
        <div className="ai-pulse">
          <Sparkles size={24} />
        </div>
        <p>Analysing your health data...</p>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className="insights-empty">
        <div className="insights-empty-icon">
          <Sparkles size={28} strokeWidth={1.5} />
        </div>
        <p>Get personalised health insights powered by AI.</p>
        <p className="insights-hint">Click Refresh to analyse your data.</p>
      </div>
    )
  }

  return (
    <div className="insights-content">
      <p className="insights-overview">{insights.overview}</p>

      {insights.recommendations?.length > 0 && (
        <div className="insights-recommendations">
          {insights.recommendations.slice(0, 3).map((rec: string, i: number) => (
            <div key={i} className="rec-item">
              <Award size={12} />
              <span>{rec}</span>
            </div>
          ))}
        </div>
      )}

      {insights.motivationalMessage && (
        <div className="insights-motivation">
          <span className="motivation-icon">✨</span>
          <p>{insights.motivationalMessage}</p>
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
