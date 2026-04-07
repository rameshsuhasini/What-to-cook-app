import api from '@/lib/axios'

// ── Types ────────────────────────────────────────────────

export interface GroceryItem {
  id: string
  groceryListId: string
  ingredientName: string
  quantity: number | null
  unit: string | null
  category: string | null
  isChecked: boolean
  createdAt: string
  updatedAt: string
}

export interface GroceryListMeta {
  id: string
  userId: string
  mealPlanId: string | null
  createdAt: string
  updatedAt: string
}

export interface GroceryCategory {
  name: string
  items: GroceryItem[]
}

export interface GrocerySummary {
  totalItems: number
  checkedItems: number
  remainingItems: number
}

export interface GroceryListGrouped {
  list: GroceryListMeta
  categories: GroceryCategory[]
  summary: GrocerySummary
}

export interface AddGroceryItemPayload {
  ingredientName: string
  quantity?: number
  unit?: string
  category?: string
}

export interface UpdateGroceryItemPayload {
  ingredientName?: string
  quantity?: number | null
  unit?: string | null
  category?: string | null
  isChecked?: boolean
}

// ── API calls ─────────────────────────────────────────────

export const groceryApi = {
  getGroceryList: async (): Promise<GroceryListGrouped | null> => {
    const res = await api.get('/groceries')
    return res.data.data.list
  },

  getGroceryListById: async (id: string): Promise<GroceryListGrouped> => {
    const res = await api.get(`/groceries/${id}`)
    return res.data.data.list
  },

  generateFromMealPlan: async (mealPlanId: string): Promise<GroceryListGrouped> => {
    const res = await api.post('/groceries/generate', { mealPlanId })
    return res.data.data.list
  },

  addItem: async (
    groceryListId: string,
    item: AddGroceryItemPayload
  ): Promise<GroceryItem> => {
    const res = await api.post(`/groceries/${groceryListId}/items`, item)
    return res.data.data.item
  },

  updateItem: async (
    itemId: string,
    data: UpdateGroceryItemPayload
  ): Promise<GroceryItem> => {
    const res = await api.put(`/groceries/item/${itemId}`, data)
    return res.data.data.item
  },

  deleteItem: async (itemId: string): Promise<void> => {
    await api.delete(`/groceries/item/${itemId}`)
  },

  checkAll: async (groceryListId: string, isChecked: boolean): Promise<void> => {
    await api.put(`/groceries/${groceryListId}/check-all`, { isChecked })
  },

  deleteList: async (groceryListId: string): Promise<void> => {
    await api.delete(`/groceries/${groceryListId}`)
  },
}
