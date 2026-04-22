// ─────────────────────────────────────────
// Recipe Import Service
//
// Handles importing recipes from external URLs:
// - YouTube videos (transcript + description)
// - Public recipe web pages (schema.org JSON-LD or raw text)
//
// Flow: detect URL → fetch content → pass to Claude AI → return structured recipe
// ─────────────────────────────────────────

import axios from 'axios'
import * as cheerio from 'cheerio'
import { extractRecipeFromContent, ImportRecipeDTO } from '../ai/recipeImportAI'
import { UserContext } from '../ai/types/ai.types'

// ── URL detection ────────────────────────

const YOUTUBE_REGEX = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/

const extractYouTubeVideoId = (url: string): string | null => {
  const patterns = [
    /youtube\.com\/watch\?v=([\w-]+)/,
    /youtu\.be\/([\w-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

const isYouTubeUrl = (url: string): boolean => YOUTUBE_REGEX.test(url)

// ── YouTube content fetcher ──────────────

const fetchYouTubeContent = async (url: string): Promise<string> => {
  const videoId = extractYouTubeVideoId(url)
  if (!videoId) throw new Error('Invalid YouTube URL')

  const parts: string[] = []

  // Fetch video metadata (title + description) via YouTube Data API
  const apiKey = process.env.YOUTUBE_API_KEY
  if (apiKey) {
    try {
      const metaRes = await axios.get(
        'https://www.googleapis.com/youtube/v3/videos',
        {
          params: { part: 'snippet', id: videoId, key: apiKey },
          timeout: 10_000,
        }
      )
      const snippet = metaRes.data?.items?.[0]?.snippet
      if (snippet) {
        parts.push(`Title: ${snippet.title}`)
        if (snippet.description) {
          parts.push(`Description:\n${snippet.description}`)
        }
      }
    } catch {
      // Non-fatal — continue without metadata
    }
  }

  // Fetch transcript by scraping the YouTube page for caption track URL
  try {
    const pageRes = await axios.get<string>(`https://www.youtube.com/watch?v=${videoId}`, {
      timeout: 10_000,
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    })
    const pageHtml = pageRes.data

    // Extract the serialised player response JSON embedded in the page
    const match = pageHtml.match(/"captions":(\{.+?\}),"videoDetails"/)
    if (match) {
      const captionsJson = JSON.parse(match[1]) as {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: { baseUrl: string; languageCode: string }[]
        }
      }
      const tracks = captionsJson.playerCaptionsTracklistRenderer?.captionTracks ?? []
      // Prefer English, fallback to first available
      const track =
        tracks.find((t) => t.languageCode.startsWith('en')) ?? tracks[0]

      if (track?.baseUrl) {
        const xmlRes = await axios.get<string>(track.baseUrl, { timeout: 8_000 })
        // Strip XML tags and decode HTML entities to get plain text
        const text = xmlRes.data
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim()
        if (text) parts.push(`Transcript:\n${text}`)
      }
    }
  } catch {
    // Non-fatal — continue with whatever we have (title + description)
  }

  if (parts.length === 0) {
    throw new Error(
      'This YouTube video has no transcript or description available. ' +
      'Try a video with closed captions enabled.'
    )
  }

  if (parts.length === 0) {
    throw new Error('Could not retrieve any content from this YouTube video.')
  }

  return parts.join('\n\n')
}

// ── Web page content fetcher ─────────────

/**
 * Try to extract schema.org/Recipe JSON-LD from the page.
 * Most major recipe sites embed this structured data — it's the cleanest source.
 */
const extractSchemaOrgRecipe = ($: cheerio.CheerioAPI): string | null => {
  const scripts = $('script[type="application/ld+json"]')
  for (let i = 0; i < scripts.length; i++) {
    try {
      const raw = $(scripts[i]).html()
      if (!raw) continue
      const data = JSON.parse(raw)

      // Handle both single object and @graph array
      const candidates = Array.isArray(data['@graph'])
        ? data['@graph']
        : [data]

      for (const item of candidates) {
        if (item['@type'] === 'Recipe' || item['@type']?.includes?.('Recipe')) {
          return JSON.stringify(item)
        }
      }
    } catch {
      // Malformed JSON-LD — skip
    }
  }
  return null
}

/**
 * Fallback: strip HTML and return readable page text.
 * Targets common recipe content selectors before falling back to body.
 */
const extractPageText = ($: cheerio.CheerioAPI): string => {
  // Remove noise elements
  $('script, style, nav, header, footer, aside, [class*="ad"], [id*="ad"]').remove()

  // Try recipe-specific containers first
  const recipeSelectors = [
    '[class*="recipe"]', '[id*="recipe"]',
    'article', 'main', '.entry-content', '.post-content',
  ]

  for (const selector of recipeSelectors) {
    const el = $(selector).first()
    if (el.length) {
      const text = el.text().replace(/\s+/g, ' ').trim()
      if (text.length > 200) return text
    }
  }

  return $('body').text().replace(/\s+/g, ' ').trim()
}

const fetchWebPageContent = async (url: string): Promise<{ content: string; imageUrl: string | null }> => {
  const response = await axios.get<string>(url, {
    timeout: 15_000,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    maxRedirects: 5,
    validateStatus: null,
  }).catch((err: unknown) => {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED') {
        throw new Error('The page took too long to respond. Please try a different URL.')
      }
    }
    throw new Error('Could not reach the provided URL. Please check it and try again.')
  })

  const status = response.status
  if (status === 401 || status === 403) {
    throw new Error(
      'This page requires a login or subscription to access. ' +
      'Try a publicly available recipe page.'
    )
  }
  if (status === 404) {
    throw new Error('The URL you provided does not exist (404).')
  }
  if (status >= 400) {
    throw new Error('Could not reach the provided URL. Please check it and try again.')
  }

  const contentType: string = (response.headers['content-type'] as string) ?? ''
  if (!contentType.includes('text/html')) {
    throw new Error('The URL does not point to a web page. Please provide a recipe page URL.')
  }

  const $ = cheerio.load(response.data)

  // Extract og:image for use as recipe image
  const ogImage = $('meta[property="og:image"]').attr('content')
    ?? $('meta[name="twitter:image"]').attr('content')
    ?? null

  // Prefer clean schema.org structured data
  const schemaContent = extractSchemaOrgRecipe($)
  if (schemaContent) return { content: schemaContent, imageUrl: ogImage }

  // Fallback to page text
  const pageText = extractPageText($)
  if (pageText.length < 100) {
    throw new Error(
      'The page content appears to be behind a paywall or JavaScript-rendered. ' +
      'Try a different recipe URL.'
    )
  }

  return { content: pageText, imageUrl: ogImage }
}

// ── YouTube thumbnail (no API key needed) ─

const getYouTubeThumbnail = (videoId: string): string =>
  `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`

// ── Public service method ────────────────

export interface ImportFromUrlResult {
  recipe: Awaited<ReturnType<typeof extractRecipeFromContent>>
  sourceUrl: string
  sourceType: 'youtube' | 'webpage'
  imageUrl: string | null
}

export class RecipeImportService {
  async importFromUrl(url: string, user: UserContext): Promise<ImportFromUrlResult> {
    try {
      new URL(url)
    } catch {
      throw new Error('The URL you provided is not valid. Please check it and try again.')
    }

    const sourceType: 'youtube' | 'webpage' = isYouTubeUrl(url) ? 'youtube' : 'webpage'

    let rawContent: string
    let imageUrl: string | null = null

    if (sourceType === 'youtube') {
      rawContent = await fetchYouTubeContent(url)
      const videoId = extractYouTubeVideoId(url)
      if (videoId) imageUrl = getYouTubeThumbnail(videoId)
    } else {
      const result = await fetchWebPageContent(url)
      rawContent = result.content
      imageUrl = result.imageUrl
    }

    const dto: ImportRecipeDTO = { rawContent, sourceUrl: url, sourceType }
    const recipe = await extractRecipeFromContent(dto, user)

    return { recipe, sourceUrl: url, sourceType, imageUrl }
  }
}

export default new RecipeImportService()
