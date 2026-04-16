// ─────────────────────────────────────────
// AI Service — Core Claude API Client
//
// All Claude API calls go through here.
// Handles:
// - SDK initialisation (singleton)
// - Base message sending
// - JSON response parsing and validation
// - Error handling and retries
//
// Never call the Anthropic SDK directly
// from anywhere else in the app.
// ─────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk'

// ── Singleton client ─────────────────────
// One instance shared across all AI calls.
// Prevents creating new connections on
// every request.

let client: Anthropic | null = null

const getClient = (): Anthropic => {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set in environment variables')
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return client
}

// ── Model config ─────────────────────────

const MODEL = 'claude-sonnet-4-20250514'

// ── Token limits per feature ─────────────
// Set thoughtfully — too low = truncated
// responses, too high = expensive calls

export const TOKEN_LIMITS = {
  recipeGenerator: 2000,
  mealPlanGenerator: 4000,
  healthInsights: 1500,
  pantrySuggestions: 3000,
  groceryAggregator: 8000,  // full week output: ~50-80 unique items
  starterRecipePack: 1000,  // planning stage only — titles + descriptions
} as const

// ── Base message sender ──────────────────

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface AIRequestOptions {
  systemPrompt: string
  userMessage: string
  maxTokens: number
}

/**
 * Send a message to Claude and return the text response.
 * All AI features use this as their base.
 */
export const sendAIMessage = async (
  options: AIRequestOptions
): Promise<string> => {
  const anthropic = getClient()

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: options.maxTokens,
    system: options.systemPrompt,
    messages: [{ role: 'user', content: options.userMessage }],
  })

  // Extract text from the response content blocks
  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response received from AI')
  }

  return textBlock.text
}

/**
 * Send a message and parse the response as JSON.
 * Strips markdown code fences if present.
 * Throws a clear error if JSON parsing fails.
 */
export const sendAIMessageJSON = async <T>(
  options: AIRequestOptions
): Promise<T> => {
  const rawText = await sendAIMessage(options)

  // Strip markdown code fences if Claude wrapped in ```json ... ```
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch {
    throw new Error(
      `AI returned invalid JSON. Raw response: ${cleaned.slice(0, 200)}...`
    )
  }
}

/**
 * Build a consistent JSON instruction suffix
 * appended to every system prompt to enforce
 * structured output from Claude.
 */
export const JSON_INSTRUCTION = `
CRITICAL INSTRUCTIONS:
- Respond ONLY with valid JSON — no preamble, no explanation, no markdown
- Do not wrap in code fences
- Follow the exact schema provided
- All fields are required unless marked optional
- Numbers must be integers or decimals, not strings
`
