// ─────────────────────────────────────────
// Pantry Types & DTOs
// ─────────────────────────────────────────

// ── Input DTOs ──────────────────────────

export interface CreatePantryItemDTO {
  ingredientName: string
  quantity?: number
  unit?: string
}

export interface UpdatePantryItemDTO {
  ingredientName?: string
  quantity?: number | null
  unit?: string | null
}

export interface BulkAddPantryItemsDTO {
  items: CreatePantryItemDTO[]
}

export interface PantryQueryDTO {
  search?: string
  page?: number
  limit?: number
}

// ── Response shapes ──────────────────────

export interface PantryItemResponse {
  id: string
  userId: string
  ingredientName: string
  quantity: number | null
  unit: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PaginatedPantryResponse {
  items: PantryItemResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}
