// ─────────────────────────────────────────
// Grocery Types & DTOs
// ─────────────────────────────────────────

// ── Input DTOs ──────────────────────────

export interface CreateGroceryItemDTO {
  ingredientName: string
  quantity?: number
  unit?: string
  category?: string
}

export interface UpdateGroceryItemDTO {
  ingredientName?: string
  quantity?: number | null
  unit?: string | null
  category?: string | null
  isChecked?: boolean
}

export interface GenerateGroceryListDTO {
  mealPlanId: string
}

// ── Response shapes ──────────────────────

export interface GroceryItemResponse {
  id: string
  groceryListId: string
  ingredientName: string
  quantity: number | null
  unit: string | null
  category: string | null
  isChecked: boolean
  createdAt: Date
  updatedAt: Date
}

export interface GroceryListResponse {
  id: string
  userId: string
  mealPlanId: string | null
  createdAt: Date
  updatedAt: Date
  items: GroceryItemResponse[]
}

// ── Grouped view ─────────────────────────
// Items grouped by category for better UX
// e.g. Produce, Dairy, Meat, Pantry etc.

export interface GroceryListGroupedResponse {
  list: Omit<GroceryListResponse, 'items'>
  categories: {
    name: string
    items: GroceryItemResponse[]
  }[]
  summary: {
    totalItems: number
    checkedItems: number
    remainingItems: number
  }
}
