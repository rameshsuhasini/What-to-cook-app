'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Minus, Scale,
  Flame, X, Check, RefreshCw, Calendar,
  Target, ArrowUp, ArrowDown, Plus, Activity,
} from 'lucide-react'
import {
  AreaChart, Area, ComposedChart, Bar, Line, Legend,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from 'recharts'
import { healthApi, WeightLog, NutritionLog } from '@/services/health.service'
import { profileApi } from '@/services/profile.service'
import { useAuthStore } from '@/store/auth.store'
import './progress.css'

// ── Animation variants ───────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
  }),
}

// ── BMI helpers ──────────────────────────

function calcBMI(weightKg: number, heightCm: number): number {
  return weightKg / Math.pow(heightCm / 100, 2)
}

function bmiCategory(bmi: number): { label: string; color: 'teal' | 'amber' | 'coral' | 'blue' } {
  if (bmi < 18.5) return { label: 'Underweight', color: 'blue' }
  if (bmi < 25)   return { label: 'Normal',      color: 'teal' }
  if (bmi < 30)   return { label: 'Overweight',  color: 'amber' }
  return               { label: 'Obese',         color: 'coral' }
}

// ── TDEE helpers ──────────────────────────

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  SEDENTARY:   1.2,
  LIGHT:       1.375,
  MODERATE:    1.55,
  ACTIVE:      1.725,
  VERY_ACTIVE: 1.9,
}

const ACTIVITY_LABELS: Record<string, string> = {
  SEDENTARY:   'Sedentary',
  LIGHT:       'Lightly active',
  MODERATE:    'Moderately active',
  ACTIVE:      'Very active',
  VERY_ACTIVE: 'Extra active',
}

function calcTDEE(
  weightKg: number,
  heightCm: number,
  age: number,
  gender: string | null,
  activityLevel: string
): number {
  // Mifflin-St Jeor BMR
  const base = (10 * weightKg) + (6.25 * heightCm) - (5 * age)
  const bmr = gender === 'MALE' ? base + 5 : gender === 'FEMALE' ? base - 161 : base - 78
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55))
}

// ── Custom tooltips ──────────────────────

function WeightTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="pg-tooltip">
      <p className="pg-tooltip-label">{label}</p>
      <p className="pg-tooltip-val">{payload[0].value} kg</p>
    </div>
  )
}

function NutritionTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="pg-tooltip">
      <p className="pg-tooltip-label">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="pg-tooltip-val">
          {p.name}: {p.value}{p.dataKey === 'calories' ? ' kcal' : 'g'}
        </p>
      ))}
    </div>
  )
}

// ── Deep-link handler (isolated for Suspense) ────────────────────────────────
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
    if (open === 'weight-log') onWeightLog()
    else if (open === 'nutrition-log') onNutritionLog()
  }, [searchParams, onWeightLog, onNutritionLog])
  return null
}

// ── Page ─────────────────────────────────

function ProgressPageInner() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'weight' | 'nutrition'>('weight')
  const [showWeightModal, setShowWeightModal] = useState(false)
  const [showNutritionModal, setShowNutritionModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [weightRange, setWeightRange] = useState<7 | 30 | 90>(30)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Queries ──────────────────────────────

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: () => profileApi.getProfile(),
  })

  const { data: weightData, isLoading: weightLoading } = useQuery({
    queryKey: ['weight-logs-full'],
    queryFn: () => healthApi.getWeightLogs({ limit: 60 }),
  })

  const { data: nutritionData, isLoading: nutritionLoading } = useQuery({
    queryKey: ['nutrition-logs-full'],
    queryFn: () => healthApi.getNutritionLogs({ limit: 14 }),
  })

  // ── Mutations ────────────────────────────

  const addWeightMutation = useMutation({
    mutationFn: (payload: { weightKg: number; logDate: string; notes?: string }) =>
      healthApi.addWeightLog(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weight-logs-full'] })
      queryClient.invalidateQueries({ queryKey: ['weight-logs'] })
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      // Modal handles its own success state and closes after 800ms
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
      // Modal handles its own success state and closes after 800ms
    },
    onError: (err: Error) => showToast(err.message || 'Failed to log nutrition', 'error'),
  })

  // ── Derived data ─────────────────────────

  const weightLogs: WeightLog[]     = weightData?.logs ?? []
  const weightStats                  = weightData?.stats
  const nutritionLogs: NutritionLog[] = nutritionData?.logs ?? []
  const todayNutrition               = nutritionData?.today

  const calorieGoal  = user?.profile?.calorieGoal  ?? 2000
  const proteinGoal  = user?.profile?.proteinGoal  ?? 150
  const carbGoal     = user?.profile?.carbGoal     ?? 200
  const fatGoal      = user?.profile?.fatGoal      ?? 65

  // Profile reference values
  const profileWeight  = profile?.weightKg     ?? null
  const profileHeight  = profile?.heightCm     ?? null
  const targetWeight   = profile?.targetWeightKg ?? null

  // Current weight: prefer latest log, fall back to profile value
  const currentWeight = weightStats?.current ?? profileWeight

  // BMI — use current weight + profile height
  const bmi = currentWeight && profileHeight
    ? parseFloat(calcBMI(currentWeight, profileHeight).toFixed(1))
    : null
  const bmiInfo = bmi ? bmiCategory(bmi) : null

  // TDEE — needs weight, height, age, gender, activityLevel
  const profileAge          = profile?.age ?? null
  const profileGender       = profile?.gender ?? null
  const profileActivityLevel = profile?.activityLevel ?? null
  const tdee = currentWeight && profileHeight && profileAge && profileActivityLevel
    ? calcTDEE(currentWeight, profileHeight, profileAge, profileGender, profileActivityLevel)
    : null
  const tdeeActivityLabel = profileActivityLevel ? ACTIVITY_LABELS[profileActivityLevel] : null

  // Sort logs ascending (oldest first) — API may return newest-first
  const sortedWeightLogs = [...weightLogs]
    .sort((a, b) => new Date(a.logDate).getTime() - new Date(b.logDate).getTime())

  // Goal progress
  const startWeight = sortedWeightLogs.length > 0
    ? sortedWeightLogs[0].weightKg   // oldest log is first after sort
    : profileWeight
  const goalProgress = (() => {
    if (startWeight == null || currentWeight == null || targetWeight == null) return null
    const total = Math.abs(startWeight - targetWeight)
    if (total === 0) return 100
    const achieved = Math.abs(startWeight - currentWeight)
    return Math.min(100, Math.max(0, Math.round((achieved / total) * 100)))
  })()

  const kgToGoal = currentWeight != null && targetWeight != null
    ? parseFloat(Math.abs(currentWeight - targetWeight).toFixed(1))
    : null

  // Chart data — ascending, filtered to the selected day range
  const cutoffMs = Date.now() - weightRange * 24 * 60 * 60 * 1000
  const weightChartData = sortedWeightLogs
    .filter(l => new Date(l.logDate).getTime() >= cutoffMs)
    .map(l => ({
      date: new Date(l.logDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      weight: l.weightKg,
    }))

  const nutritionChartData = [...nutritionLogs]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-14)
    .map(l => ({
      date: new Date(l.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      calories: l.calories,
      protein: l.protein,
      carbs: l.carbs,
      fat: l.fat,
    }))

  // No logs yet but profile has a weight → show prompt instead of empty state
  const showWeightPrompt = weightLogs.length === 0 && profileWeight != null

  return (
    <div className="pg-root">
      {/* ── Toast ── */}
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

      {/* ── Header ── */}
      <motion.header
        className="pg-header"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div>
          <p className="pg-eyebrow">Tracking</p>
          <h1 className="pg-title">My Progress</h1>
        </div>
        <div className="pg-header-actions">
          <button className="pg-btn pg-btn--secondary" onClick={() => setShowNutritionModal(true)}>
            <Flame size={15} />
            Log nutrition
          </button>
          <button className="pg-btn pg-btn--primary" onClick={() => setShowWeightModal(true)}>
            <Scale size={15} />
            Log weight
          </button>
        </div>
      </motion.header>

      {/* ── Stats grid ── */}
      <motion.div
        className="pg-stats-grid"
        custom={0} variants={fadeUp}
        initial="hidden" animate="visible"
      >
        {/* Current weight */}
        <StatCard
          label="Current weight"
          value={currentWeight != null ? `${currentWeight} kg` : '—'}
          icon={<Scale size={18} />}
          color="teal"
          extra={profileWeight && weightLogs.length === 0 ? 'From profile' : undefined}
        />

        {/* Target weight */}
        <StatCard
          label="Target weight"
          value={targetWeight != null ? `${targetWeight} kg` : '—'}
          icon={<Target size={18} />}
          color="blue"
          extra={kgToGoal != null ? `${kgToGoal} kg to go` : undefined}
        />

        {/* BMI */}
        <StatCard
          label="BMI"
          value={bmi != null ? `${bmi}` : '—'}
          icon={<Activity size={18} />}
          color={bmiInfo?.color ?? 'neutral'}
          extra={bmiInfo?.label}
        />

        {/* TDEE */}
        <StatCard
          label="Daily energy (TDEE)"
          value={tdee != null ? `${tdee} kcal` : '—'}
          icon={<Flame size={18} />}
          color="coral"
          extra={tdee != null ? tdeeActivityLabel ?? undefined : 'Set activity level in profile'}
        />

        {/* Today's calories */}
        <StatCard
          label="Today's calories"
          value={todayNutrition ? `${todayNutrition.calories} kcal` : '—'}
          icon={<Flame size={18} />}
          color="amber"
          extra={`Goal: ${calorieGoal} kcal`}
        />
      </motion.div>

      {/* ── Goal progress card ── */}
      {goalProgress != null && targetWeight != null && currentWeight != null && (
        <motion.div
          className="pg-goal-card"
          custom={1} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <div className="pg-goal-header">
            <Target size={16} />
            <h2>Goal progress</h2>
            <span className="pg-goal-pct">{goalProgress}%</span>
          </div>
          <div className="pg-goal-track">
            <motion.div
              className="pg-goal-fill"
              initial={{ width: 0 }}
              animate={{ width: `${goalProgress}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' as const, delay: 0.2 }}
            />
          </div>
          <div className="pg-goal-labels">
            <span>Start: {startWeight} kg</span>
            <span className="pg-goal-remaining">
              {currentWeight === targetWeight
                ? '🎉 Goal reached!'
                : `${kgToGoal} kg remaining`}
            </span>
            <span>Goal: {targetWeight} kg</span>
          </div>
        </motion.div>
      )}

      {/* ── Today's macros ── */}
      {todayNutrition && (
        <motion.div
          className="pg-macros"
          custom={2} variants={fadeUp}
          initial="hidden" animate="visible"
        >
          <h2 className="pg-section-title">Today's macros</h2>
          <div className="pg-macro-bars">
            <MacroBar label="Protein" value={todayNutrition.protein} goal={proteinGoal} color="#1d9e75" unit="g" />
            <MacroBar label="Carbs"   value={todayNutrition.carbs}   goal={carbGoal}    color="#ba7517" unit="g" />
            <MacroBar label="Fat"     value={todayNutrition.fat}     goal={fatGoal}     color="#378add" unit="g" />
          </div>
        </motion.div>
      )}

      {/* ── Tabs ── */}
      <motion.div
        className="pg-tabs"
        custom={3} variants={fadeUp}
        initial="hidden" animate="visible"
      >
        <button
          className={`pg-tab ${activeTab === 'weight' ? 'pg-tab--active' : ''}`}
          onClick={() => setActiveTab('weight')}
        >
          <Scale size={15} />
          Weight trend
        </button>
        <button
          className={`pg-tab ${activeTab === 'nutrition' ? 'pg-tab--active' : ''}`}
          onClick={() => setActiveTab('nutrition')}
        >
          <Flame size={15} />
          Nutrition history
        </button>
      </motion.div>

      {/* ── Chart panels ── */}
      <AnimatePresence mode="wait">

        {/* Weight tab */}
        {activeTab === 'weight' && (
          <motion.div
            key="weight"
            className="pg-chart-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="pg-chart-header">
              <div>
                <h2>Weight over time</h2>
                <span className="pg-chart-sub">{weightChartData.length} entries</span>
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

            {weightLoading ? (
              <div className="pg-chart-skeleton" />
            ) : showWeightPrompt ? (
              /* No logs yet but profile has weight — prompt to log today */
              <div className="pg-weight-prompt">
                <div className="pg-weight-prompt-icon"><Scale size={28} /></div>
                <div>
                  <p className="pg-weight-prompt-title">Log today's weight to start tracking</p>
                  <p className="pg-weight-prompt-sub">
                    Your profile shows <strong>{profileWeight} kg</strong>. Confirm it as your starting point.
                  </p>
                </div>
                <button
                  className="pg-btn pg-btn--primary"
                  onClick={() => setShowWeightModal(true)}
                >
                  <Plus size={14} />
                  Log today
                </button>
              </div>
            ) : weightChartData.length === 0 ? (
              <div className="pg-chart-empty">
                <Scale size={32} />
                <p>No weight entries yet. Start logging your weight!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={weightChartData} margin={{ top: 8, right: 48, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#1d9e75" stopOpacity={0.18} />
                      <stop offset="95%" stopColor="#1d9e75" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d8" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8880' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8a8880' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={<WeightTooltip />} />
                  {targetWeight && (
                    <ReferenceLine
                      y={targetWeight}
                      stroke="#d85a30"
                      strokeDasharray="4 4"
                      label={{ value: 'Your goal', position: 'insideRight', fontSize: 11, fill: '#d85a30', dx: 4 }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="#1d9e75"
                    strokeWidth={2.5}
                    fill="url(#weightGrad)"
                    // single-point: render a visible scatter dot; line needs 2+ points
                    dot={{ r: weightChartData.length === 1 ? 6 : 3, fill: '#1d9e75', strokeWidth: 2, stroke: 'white' }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Recent log entries — newest first */}
            {weightLogs.length > 0 && (
              <div className="pg-log-list">
                <h3 className="pg-log-title">Recent entries</h3>
                {/* Take latest 8 from ascending-sorted logs, then reverse for newest-at-top display */}
                {[...sortedWeightLogs].slice(-8).reverse().map((log, i, arr) => {
                  // arr[i+1] is the entry from the day BEFORE this one (older)
                  const olderEntry = arr[i + 1]
                  const diff = olderEntry ? log.weightKg - olderEntry.weightKg : null
                  return (
                    <div key={log.id} className="pg-log-row">
                      <div className="pg-log-date">
                        <Calendar size={13} />
                        {new Date(log.logDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                      <div className="pg-log-weight">{log.weightKg} kg</div>
                      {diff != null && (
                        <div className={`pg-log-diff ${diff < 0 ? 'pg-log-diff--down' : diff > 0 ? 'pg-log-diff--up' : ''}`}>
                          {diff < 0 ? <ArrowDown size={12} /> : diff > 0 ? <ArrowUp size={12} /> : <Minus size={12} />}
                          {Math.abs(diff).toFixed(1)} kg
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Nutrition tab */}
        {activeTab === 'nutrition' && (
          <motion.div
            key="nutrition"
            className="pg-chart-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <div className="pg-chart-header">
              <h2>Nutrition history</h2>
              <span className="pg-chart-sub">Last 14 days</span>
            </div>

            {nutritionLoading ? (
              <div className="pg-chart-skeleton" />
            ) : nutritionChartData.length === 0 ? (
              <div className="pg-chart-empty">
                <Flame size={32} />
                <p>No nutrition entries yet. Start tracking your meals!</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={nutritionChartData} margin={{ top: 8, right: 56, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d8" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#8a8880' }} tickLine={false} />
                  {/* Left Y axis — grams for macros */}
                  <YAxis yAxisId="macros" tick={{ fontSize: 11, fill: '#8a8880' }} tickLine={false} axisLine={false} />
                  {/* Right Y axis — kcal for calories */}
                  <YAxis yAxisId="cal" orientation="right" tick={{ fontSize: 11, fill: '#8a8880' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<NutritionTooltip />} />
                  <Legend
                    iconSize={10}
                    iconType="circle"
                    wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
                  />
                  <ReferenceLine
                    yAxisId="cal"
                    y={calorieGoal}
                    stroke="#d85a30"
                    strokeDasharray="4 4"
                    label={{ value: 'Cal goal', position: 'insideRight', fontSize: 10, fill: '#d85a30', dx: 4 }}
                  />
                  {/* Calories as subtle background bars */}
                  <Bar
                    yAxisId="cal"
                    dataKey="calories"
                    name="Calories (kcal)"
                    fill="#1d9e75"
                    fillOpacity={0.18}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={38}
                  />
                  {/* Macro lines */}
                  <Line yAxisId="macros" type="monotone" dataKey="protein" name="Protein (g)"  stroke="#1d9e75" strokeWidth={2} dot={{ r: 3, fill: '#1d9e75' }} activeDot={{ r: 5 }} />
                  <Line yAxisId="macros" type="monotone" dataKey="carbs"   name="Carbs (g)"    stroke="#ba7517" strokeWidth={2} dot={{ r: 3, fill: '#ba7517' }} activeDot={{ r: 5 }} />
                  <Line yAxisId="macros" type="monotone" dataKey="fat"     name="Fat (g)"      stroke="#378add" strokeWidth={2} dot={{ r: 3, fill: '#378add' }} activeDot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}

            {nutritionLogs.length > 0 && (() => {
              // Newest first for the table
              const tableRows = [...nutritionLogs]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 10)
              return (
                <div className="pg-nutrition-table">
                  <h3 className="pg-log-title">Macro breakdown</h3>
                  <div className="pg-table-wrap">
                    <table className="pg-table">
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
                        {tableRows.map((log, i) => {
                          // Previous day's entry is the next item in the newest-first array
                          const prev = tableRows[i + 1]
                          const calDiff  = prev ? log.calories - prev.calories : null
                          const protDiff = prev ? log.protein  - prev.protein  : null
                          const carbDiff = prev ? log.carbs    - prev.carbs    : null
                          const fatDiff  = prev ? log.fat      - prev.fat      : null
                          return (
                            <tr key={log.id}>
                              <td className="pg-td--date">
                                {new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </td>
                              <td>
                                <div className="pg-td-cell">
                                  <span className="pg-td--calories">{log.calories} kcal</span>
                                  {calDiff != null && calDiff !== 0 && (
                                    <span className={`pg-log-diff pg-log-diff--${calDiff > 0 ? 'up' : 'down'}`}>
                                      {calDiff > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                      {Math.abs(calDiff)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="pg-td-cell">
                                  {log.protein}g
                                  {protDiff != null && protDiff !== 0 && (
                                    <span className={`pg-log-diff pg-log-diff--${protDiff > 0 ? 'up' : 'down'}`}>
                                      {protDiff > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                      {Math.abs(protDiff)}g
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="pg-td-cell">
                                  {log.carbs}g
                                  {carbDiff != null && carbDiff !== 0 && (
                                    <span className={`pg-log-diff pg-log-diff--${carbDiff > 0 ? 'up' : 'down'}`}>
                                      {carbDiff > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                      {Math.abs(carbDiff)}g
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="pg-td-cell">
                                  {log.fat}g
                                  {fatDiff != null && fatDiff !== 0 && (
                                    <span className={`pg-log-diff pg-log-diff--${fatDiff > 0 ? 'up' : 'down'}`}>
                                      {fatDiff > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                                      {Math.abs(fatDiff)}g
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Log weight modal ── */}
      <AnimatePresence>
        {showWeightModal && (
          <LogWeightModal
            isLoading={addWeightMutation.isPending}
            isSuccess={addWeightMutation.isSuccess}
            initialWeight={showWeightPrompt ? profileWeight?.toString() : undefined}
            onClose={() => { setShowWeightModal(false); addWeightMutation.reset() }}
            onSubmit={(payload) => addWeightMutation.mutate(payload)}
            onSuccessDone={() => { setShowWeightModal(false); addWeightMutation.reset() }}
          />
        )}
      </AnimatePresence>

      {/* ── Log nutrition modal ── */}
      <AnimatePresence>
        {showNutritionModal && (
          <LogNutritionModal
            isLoading={addNutritionMutation.isPending}
            isSuccess={addNutritionMutation.isSuccess}
            goals={{ calories: calorieGoal, protein: proteinGoal, carbs: carbGoal, fat: fatGoal }}
            onClose={() => { setShowNutritionModal(false); addNutritionMutation.reset() }}
            onSubmit={(payload) => addNutritionMutation.mutate(payload)}
            onSuccessDone={() => { setShowNutritionModal(false); addNutritionMutation.reset() }}
          />
        )}
      </AnimatePresence>

      {/* ── Deep-link handler (Suspense boundary inside) ── */}
      <Suspense fallback={null}>
        <DeepLinkHandler
          onWeightLog={() => { setShowWeightModal(true); setActiveTab('weight') }}
          onNutritionLog={() => { setShowNutritionModal(true); setActiveTab('nutrition') }}
        />
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

// ── Stat card ────────────────────────────

function StatCard({
  label, value, icon, color, extra
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: 'teal' | 'blue' | 'amber' | 'coral' | 'green' | 'neutral'
  extra?: string
}) {
  return (
    <div className={`pg-stat-card pg-stat-card--${color}`}>
      <div className="pg-stat-icon">{icon}</div>
      <div className="pg-stat-body">
        <div className="pg-stat-label">{label}</div>
        <div className="pg-stat-value">{value}</div>
        {extra && <div className="pg-stat-extra">{extra}</div>}
      </div>
    </div>
  )
}

// ── Macro progress bar ───────────────────

function MacroBar({
  label, value, goal, color, unit
}: {
  label: string
  value: number
  goal: number
  color: string
  unit: string
}) {
  const pct = Math.min(100, Math.round((value / goal) * 100))
  return (
    <div className="pg-macro-bar">
      <div className="pg-macro-top">
        <span className="pg-macro-label">{label}</span>
        <span className="pg-macro-vals">{value}{unit} / {goal}{unit}</span>
      </div>
      <div className="pg-macro-track">
        <motion.div
          className="pg-macro-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' as const }}
        />
      </div>
      <span className="pg-macro-pct" style={{ color }}>{pct}%</span>
    </div>
  )
}

// ── Log weight modal ─────────────────────

function LogWeightModal({
  isLoading,
  isSuccess,
  initialWeight,
  onClose,
  onSubmit,
  onSuccessDone,
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
  const [date, setDate] = useState(today)
  const [notes, setNotes] = useState('')

  // Auto-close after showing success state
  useEffect(() => {
    if (!isSuccess) return
    const t = setTimeout(onSuccessDone, 900)
    return () => clearTimeout(t)
  }, [isSuccess])

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
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
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
              className="pg-input"
              type="number"
              step="0.1"
              min="0"
              placeholder="e.g. 75.5"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              autoFocus
              disabled={isSuccess}
            />
          </label>
          <label className="pg-label">
            Date *
            <input
              className="pg-input"
              type="date"
              value={date}
              max={today}
              onChange={e => setDate(e.target.value)}
              disabled={isSuccess}
            />
          </label>
          <label className="pg-label">
            Notes
            <input
              className="pg-input"
              placeholder="Optional note..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              disabled={isSuccess}
            />
          </label>
          <div className="pg-modal-actions">
            <button type="button" className="pg-btn pg-btn--ghost" onClick={onClose} disabled={isSuccess}>Cancel</button>
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

// ── Log nutrition modal ──────────────────

function LogNutritionModal({
  isLoading,
  isSuccess,
  goals,
  onClose,
  onSubmit,
  onSuccessDone,
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

  // Auto-close after showing success state
  useEffect(() => {
    if (!isSuccess) return
    const t = setTimeout(onSuccessDone, 900)
    return () => clearTimeout(t)
  }, [isSuccess])

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
    { key: 'calories', label: 'Calories', unit: 'kcal', placeholder: `Goal: ${goals.calories}` },
    { key: 'protein',  label: 'Protein',  unit: 'g',    placeholder: `Goal: ${goals.protein}g` },
    { key: 'carbs',    label: 'Carbs',    unit: 'g',    placeholder: `Goal: ${goals.carbs}g` },
    { key: 'fat',      label: 'Fat',      unit: 'g',    placeholder: `Goal: ${goals.fat}g` },
  ] as const

  return (
    <div className="pg-overlay" onClick={onClose}>
      <motion.div
        className="pg-modal"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
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
              className="pg-input"
              type="date"
              value={form.date}
              max={today}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              disabled={isSuccess}
            />
          </label>
          <div className="pg-macros-grid">
            {macros.map(({ key, label, unit, placeholder }) => (
              <label key={key} className="pg-label">
                {label}
                <div className="pg-input-wrap">
                  <input
                    className="pg-input"
                    type="number"
                    min="0"
                    step="any"
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
            <button type="button" className="pg-btn pg-btn--ghost" onClick={onClose} disabled={isSuccess}>Cancel</button>
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
