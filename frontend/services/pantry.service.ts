import api from '@/lib/axios'
import type { AIPantrySuggestions } from '@/services/ai.service'

// ── Types ────────────────────────────────────────────────

export interface PantryItem {
  id: string
  userId: string
  ingredientName: string
  quantity: number | null
  unit: string | null
  createdAt: string
  updatedAt: string
}

export interface PantryPagination {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PantryListResult {
  items: PantryItem[]
  pagination: PantryPagination
}

export interface AddPantryItemPayload {
  ingredientName: string
  quantity?: number
  unit?: string
}

export interface UpdatePantryItemPayload {
  ingredientName?: string
  quantity?: number | null
  unit?: string | null
}

// ── API calls ─────────────────────────────────────────────

export const pantryApi = {
  getPantryItems: async (params?: {
    search?: string
    page?: number
    limit?: number
  }): Promise<PantryListResult> => {
    const res = await api.get('/pantry', { params })
    return res.data.data
  },

  addItem: async (payload: AddPantryItemPayload): Promise<PantryItem> => {
    const res = await api.post('/pantry', payload)
    return res.data.data.item
  },

  bulkAddItems: async (items: AddPantryItemPayload[]): Promise<PantryItem[]> => {
    const res = await api.post('/pantry/bulk', { items })
    return res.data.data.items
  },

  updateItem: async (
    id: string,
    data: UpdatePantryItemPayload
  ): Promise<PantryItem> => {
    const res = await api.put(`/pantry/${id}`, data)
    return res.data.data.item
  },

  deleteItem: async (id: string): Promise<void> => {
    await api.delete(`/pantry/${id}`)
  },

  checkSimilar: async (name: string): Promise<PantryItem[]> => {
    const res = await api.get('/pantry/check-similar', { params: { name } })
    return res.data.data.similar
  },

  mergeItems: async (keepId: string, mergeId: string): Promise<PantryItem> => {
    const res = await api.post('/pantry/merge', { keepId, mergeId })
    return res.data.data.item
  },

  clearPantry: async (): Promise<void> => {
    await api.delete('/pantry/clear')
  },

  getIngredientNames: async (): Promise<string[]> => {
    const res = await api.get('/pantry/ingredients')
    return res.data.data.ingredients
  },

  getSuggestions: async (opts?: {
    maxCookTimeMinutes?: number
    mealType?: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK'
  }): Promise<AIPantrySuggestions> => {
    const res = await api.post('/ai/pantry-suggestions', opts ?? {})
    return res.data.data.suggestions
  },
}

// Re-export from ai.service so consumers don't need two imports
export type { PantryRecipeSuggestion, AIPantrySuggestions } from '@/services/ai.service'
