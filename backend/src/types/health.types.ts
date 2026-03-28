// ─────────────────────────────────────────
// Health Tracking Types & DTOs
// ─────────────────────────────────────────

// ── Input DTOs ──────────────────────────

export interface LogWeightDTO {
  weightKg: number
  logDate: string  // ISO date string e.g. "2024-01-15"
}

export interface LogNutritionDTO {
  date: string     // ISO date string
  calories?: number
  protein?: number
  carbs?: number
  fat?: number
}

export interface UpdateNutritionDTO {
  calories?: number | null
  protein?: number | null
  carbs?: number | null
  fat?: number | null
}

export interface HealthQueryDTO {
  from?: string    // ISO date string
  to?: string      // ISO date string
  limit?: number
}

// ── Response shapes ──────────────────────

export interface WeightLogResponse {
  id: string
  userId: string
  weightKg: number
  logDate: Date
  createdAt: Date
}

export interface NutritionLogResponse {
  id: string
  userId: string
  date: Date
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  createdAt: Date
  updatedAt: Date
}

// ── Progress & trend shapes ──────────────
// Used by the dashboard charts and AI health insights

export interface WeightTrend {
  logs: WeightLogResponse[]
  stats: {
    current: number | null
    starting: number | null
    lowest: number | null
    highest: number | null
    totalChange: number | null   // positive = gained, negative = lost
    averagePerWeek: number | null
  }
}

export interface NutritionSummary {
  logs: NutritionLogResponse[]
  averages: {
    calories: number | null
    protein: number | null
    carbs: number | null
    fat: number | null
  }
  today: NutritionLogResponse | null
}
