// ─────────────────────────────────────────
// Food Image Fetcher
// Uses the Pexels API to find a relevant food photo for a recipe title.
// Returns null silently on any failure — missing image is never fatal.
// ─────────────────────────────────────────

import axios from 'axios'

export const fetchFoodImage = async (recipeTitle: string): Promise<string | null> => {
  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey) return null

  try {
    const query = encodeURIComponent(`${recipeTitle} food dish`)
    const res = await axios.get<{
      photos: { src: { large: string } }[]
    }>(
      `https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        timeout: 8_000,
      }
    )
    return res.data.photos?.[0]?.src?.large ?? null
  } catch {
    return null
  }
}
