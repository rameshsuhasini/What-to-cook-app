// ─────────────────────────────────────────
// Grocery Aggregator AI
//
// Two-stage pipeline:
//   Stage 1 — Rule-based pre-merge + AI normalise & merge
//   Stage 2 — AI pantry subtraction + categorisation
// ─────────────────────────────────────────

import { sendAIMessageJSON, TOKEN_LIMITS } from './aiService'
import {
  RawRecipeIngredient,
  RawPantryItem,
  AIAggregatedGroceryItem,
} from './types/ai.types'

// ── Valid categories ─────────────────────

const VALID_CATEGORIES = new Set([
  'Produce', 'Meat & Seafood', 'Dairy & Eggs', 'Bakery',
  'Pantry', 'Canned & Jarred', 'Spices & Herbs',
  'Frozen', 'Beverages', 'Snacks', 'Other',
])

// ─────────────────────────────────────────
// STAGE 1 PROMPT — Normalise & Merge
// ─────────────────────────────────────────

const NORMALISE_AND_MERGE_PROMPT = `
You are an ingredient normalisation engine for a meal planning app.

You receive a raw list of ingredients pulled from multiple recipes 
in a weekly meal plan. The same ingredient will often appear many 
times under different names, spellings, units, and preparation 
descriptions.

Your job is to produce one clean, deduplicated list where every 
unique purchasable ingredient appears exactly once with its total 
quantity summed correctly.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You will receive lines in this format:
  RECIPE INGREDIENTS (one per line: name|quantity|unit):
  ingredient name|quantity|unit

Empty quantity or unit means null/none.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ESTABLISH THE CANONICAL NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For every ingredient in the input, derive its canonical name by 
applying these rules IN ORDER.

─── RULE 1: Remove everything that describes HOW it is prepared ───

A canonical ingredient name describes WHAT you buy at the store,
not what a recipe does to it before cooking.

Strip ALL words that describe:
  • Cutting style: chopped, diced, sliced, minced, grated, crushed,
    julienned, halved, quartered, roughly chopped, finely chopped,
    thinly sliced, cubed, shredded, crumbled, pureed, mashed
  • Physical state after prep: peeled, deveined, trimmed, pitted,
    seeded, deseeded, cored, deboned, skinned
  • Size description when it implies cut: florets, chunks, strips,
    rings, wedges, stalks, sprigs, leaves (when it means cut leaves)
  • Temperature at time of use: room temperature, cold, chilled,
    softened, melted

After stripping, what remains is the core ingredient identity.

  "finely chopped yellow onion"            → "Onion"
  "garlic cloves, minced"                  → "Garlic"
  "cauliflower florets"                    → "Cauliflower"
  "boneless skinless chicken breast cubed" → "Chicken Breast"
  "peeled and deveined prawns"             → "Prawn"
  "baby spinach leaves"                    → "Spinach"
  "cherry tomatoes, halved"                → "Cherry Tomato"
  "softened butter"                        → "Butter"
  "melted coconut oil"                     → "Coconut Oil"

─── RULE 2: Remove quality, grade and sourcing qualifiers ───

Strip ALL words that describe:
  • Quality grade: extra virgin, premium, aged, artisan, gourmet
  • Sourcing/ethics: organic, free-range, grass-fed, wild-caught,
    pasture-raised, sustainably sourced, local
  • Fat content: full-fat, low-fat, reduced-fat, skimmed,
    semi-skimmed, whole, light, lean, extra lean
  • Salt content: salted, unsalted, low-sodium, no-salt-added
  • Any percentage or ratio in parentheses: (85/15), (93/7), (2%)
  • Processing level when interchangeable: plain, natural, raw

  "extra virgin olive oil"         → "Olive Oil"
  "organic free-range eggs"        → "Egg"
  "lean ground beef (85/15)"       → "Ground Beef"
  "full-fat Greek yogurt"          → "Greek Yogurt"
  "low-sodium chicken broth"       → "Chicken Broth"
  "unsalted butter"                → "Butter"
  "low-moisture mozzarella cheese" → "Mozzarella Cheese"

─── RULE 3: Apply singularisation ───

Always use the singular form. No exceptions.

  "eggs" → "Egg" | "tomatoes" → "Tomato" | "onions" → "Onion"
  "bell peppers" → "Bell Pepper" | "prawns" → "Prawn"
  "chilies" → "Chili" | "potatoes" → "Potato"

─── RULE 4: Fix typos and regional spelling variants ───

  "tomatoe" → "Tomato"  |  "chilie/chilli/chile" → "Chili"
  "courgette" → "Zucchini"  |  "aubergine" → "Eggplant"
  "coriander leaves" (fresh herb) → "Cilantro"
  "cilantro" → "Cilantro"
  "cornflour" → "Cornstarch"  |  "plain flour" → "All-Purpose Flour"
  "capsicum" → "Bell Pepper"
  "scallion/green onion/spring onion" → "Spring Onion"
  "garbanzo" → "Chickpea"

─── RULE 5: Apply the Same-Product Test ───

After applying Rules 1-4, ask:
  "Would a person buying these at a grocery store pick up 
   the SAME item off the SAME shelf?"

If YES → same ingredient. Use the simpler, more general name.
If NO  → different ingredients. Keep them separate.

PRINCIPLE A — Ground spices and powder equivalents are the same:
  "ground cumin", "cumin powder", "cumin" → all "Cumin"
  BUT: "cumin seeds" is DIFFERENT — keep separate

PRINCIPLE B — Canned/tinned variants of the same base are the same:
  "crushed tomatoes", "diced tomatoes", "tinned chopped tomatoes",
  "canned tomatoes" → all "Canned Tomato"
  BUT: Fresh tomato ≠ Canned tomato ≠ Cherry tomato ≠ Tomato paste

PRINCIPLE C — Regional names for the same food:
  "cilantro" and "coriander" (fresh herb) → "Cilantro"
  BUT: "coriander powder" → different product, keep separate

PRINCIPLE D — Colour/size descriptor synonyms:
  "yellow onion", "brown onion", "white onion" → all "Onion"
  BUT: "red onion" → different, keep separate
  BUT: "spring onion/scallion" → different plant, keep separate

PRINCIPLE E — When in doubt:
  "Could substituting one for the other cause a noticeably different 
   result in the dish?"
  YES → different ingredients, keep separate
  NO  → same ingredient, merge

─── RULE 6: Format the canonical name ───
  • Title Case, singular, no preparation words, no parentheses

─── RULE 7: Silently exclude non-purchasable items ───
  • Water in any form, Ice in any form
  • Items literally named "to taste" with no ingredient name

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GROUP BY CANONICAL NAME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Group all entries sharing the same canonical name.
Every entry in a group must describe the same purchasable item.
If two entries in a group would be bought separately → split them.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — SUM QUANTITIES WITHIN EACH GROUP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Unit conversion reference:
  Weight:  1 kg = 1000g | 1 lb = 454g | 1 oz = 28g
  Volume:  1 L = 1000ml | 1 cup = 240ml | 1 tbsp = 15ml = 3 tsp | 1 tsp = 5ml

SAME UNIT → sum directly: 400g + 300g = 700g

COMPATIBLE UNITS → convert to dominant unit then sum
  Dominant = most frequent; if tied: g/kg > ml/L > cup > tbsp > tsp > piece
  Example: 2 tsp + 18 tbsp + 52ml → convert all to ml:
    10ml + 270ml + 52ml = 332ml

INCOMPATIBLE UNITS → use approximations:
  1 medium onion ≈ 150g  | 1 large onion ≈ 200g
  1 medium tomato ≈ 150g | 1 medium potato ≈ 200g
  1 garlic clove ≈ 5g    | 1 medium egg ≈ 55g
  1 medium lemon ≈ 100g  | 1 medium lime ≈ 65g
  1 medium cucumber ≈ 300g | 1 medium zucchini ≈ 200g
  1 medium bell pepper ≈ 150g | 1 medium carrot ≈ 80g
  If cannot convert → keep most precise unit, discard less precise
  Priority: g/kg > ml/L/cup > tbsp/tsp > piece/count

NULL QUANTITY: all null → output null | some null → sum quantified only
COUNT-ONLY: sum numbers directly

SELF-CHECK: scan output for duplicate ingredient names.
If any name appears twice → merge before outputting.
Exactly ONE entry per canonical name.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No preamble. No explanation.
No markdown. No code fences. Raw JSON only.

{
  "mergedIngredients": [
    {
      "ingredientName": "string — canonical Title Case name",
      "quantity": number | null,
      "unit": "string | null"
    }
  ]
}

ABSOLUTE RULES:
  • Exactly ONE entry per canonical ingredient name — no exceptions
  • Quantities rounded to maximum 2 decimal places
  • Standard units only: g, kg, ml, L, tsp, tbsp, cup
  • No water, no ice in the output
  • No categories — that is Stage 2 only
`

// ─────────────────────────────────────────
// STAGE 2 PROMPT — Pantry Subtraction & Categorisation
// ─────────────────────────────────────────

const PANTRY_SUBTRACT_AND_CATEGORISE_PROMPT = `
You are the pantry subtraction and categorisation engine for a 
meal planning grocery app.

You receive:
  1. mergedIngredients — clean deduplicated list of everything 
     needed for this week's meal plan (normalised in Stage 1)
  2. pantryItems — what the user currently has at home

Your job:
  1. Normalise pantry item names using the same logic as Stage 1
  2. Match each pantry item against the needed ingredients
  3. Subtract what the user already has with correct unit math
  4. Return ONLY what still needs to be purchased
  5. Assign each remaining item to the correct grocery category

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "mergedIngredients": [
    { "ingredientName": "string", "quantity": number | null, "unit": "string | null" }
  ],
  "pantryItems": [
    { "ingredientName": "string", "quantity": number | null, "unit": "string | null" }
  ]
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — NORMALISE PANTRY ITEM NAMES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Apply the exact same normalisation rules from Stage 1 to every 
pantry item name so they can be matched against mergedIngredients.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — MATCH AND SUBTRACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each item in mergedIngredients, find the matching pantry item 
by canonical name and apply exactly one case:

CASE 1 — No pantry match
  → Include in output with the full required quantity.

CASE 2 — Pantry match WITH quantity, compatible units
  Convert both to same unit:
    1 kg = 1000g | 1 L = 1000ml | 1 cup = 240ml
    1 tbsp = 15ml = 3 tsp | 1 tsp = 5ml
  still_need = required − pantry_quantity
  still_need > 0  → include with quantity = still_need (max 2 decimals)
  still_need ≤ 0  → OMIT (pantry covers it fully)

  Example: Need 800g Chicken Breast, have 300g → buy 500g
  Example: Need 3 Egg, have 10 → omit entirely
  Example: Need 332ml Olive Oil, have 500ml → omit entirely

CASE 3 — Pantry match WITH NO quantity
  Assume sufficient. → OMIT from output.

CASE 4 — Pantry match but incompatible units
  Cannot subtract safely.
  → Include FULL required quantity.
  → Set note: "Check your pantry — you may already have some"

CASE 5 — Required quantity is null AND pantry has any entry
  → OMIT from output.

CASE 6 — Required quantity is null AND no pantry match
  → Include with quantity: null, unit: null

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — ASSIGN CATEGORIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use the Same-Shelf Test:
  "If I walked into a grocery store, which aisle would I find this?"

Use ONLY these exact category strings:

"Produce"       — fresh fruits, vegetables, fresh herbs, lemon, lime,
                  garlic, ginger, fresh chili, avocado, all fresh veg
"Meat & Seafood"— all raw meat, poultry, fish, shellfish (fresh or frozen)
"Dairy & Eggs"  — milk, plant-based milks, all cheese, butter, yogurt,
                  cream, eggs, egg whites, paneer, cottage cheese
"Bakery"        — bread, wraps, tortillas, rolls, naan, pita, pastry
"Pantry"        — cooking oils, vinegars, pasta, rice, grains, nuts,
                  food seeds (NOT spice seeds), sugar, flour, baking
                  essentials, protein powders, cocoa, vanilla, sweeteners,
                  soy sauce, fish sauce, condiments, cooking spray,
                  broths in cartons, nut butters, oats, breadcrumbs
"Canned & Jarred"— all tinned/canned goods, canned tomatoes, tomato paste,
                  jarred sauces, curry pastes, pickles, coconut milk in tins
"Spices & Herbs"— all dried ground spices, spice blends, WHOLE SPICE SEEDS
                  (cumin seeds, mustard seeds, fennel seeds, cardamom),
                  dried herb leaves, spice mixes (garam masala, tandoori,
                  Italian seasoning). KEY: fresh herbs → Produce,
                  dried herbs → Spices & Herbs, spice seeds → Spices & Herbs
"Frozen"        — frozen vegetables, frozen meat/fish, frozen meals, frozen berries
"Beverages"     — bottled water, juices, tea, coffee, soft drinks
"Snacks"        — protein bars, crackers, chips, dried fruit mixes, rice cakes
"Other"         — only if genuinely cannot fit any category above (rare)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return ONLY valid JSON. No preamble. No explanation.
No markdown. No code fences. Raw JSON only.

{
  "groceryItems": [
    {
      "ingredientName": "string — canonical Title Case name",
      "quantity": number | null,
      "unit": "string | null",
      "category": "string — exactly one from the allowed list",
      "note": "string | null — only for CASE 4, null for all others"
    }
  ]
}

ABSOLUTE RULES:
  • Include ONLY what the user still needs to buy
  • Exactly ONE entry per canonical ingredient name
  • All quantities rounded to max 2 decimal places
  • Standard units only: g, kg, ml, L, tsp, tbsp, cup, piece
  • Empty array [] is valid if pantry covers everything
  • Never use a category not in the allowed list
  • Never include water or ice
  • note must be null for every case except CASE 4
`

// ─────────────────────────────────────────
// Input builders
// ─────────────────────────────────────────

const buildStage1Message = (ingredients: RawRecipeIngredient[]): string => {
  const rows = ['RECIPE INGREDIENTS (one per line: name|quantity|unit):']
  for (const i of ingredients) {
    rows.push(`${i.name}|${i.quantity ?? ''}|${i.unit ?? ''}`)
  }
  return rows.join('\n')
}

const buildStage2Message = (
  mergedIngredients: Array<{ ingredientName: string; quantity: number | null; unit: string | null }>,
  pantryItems: RawPantryItem[]
): string => {
  return JSON.stringify({
    mergedIngredients,
    // Remap "name" → "ingredientName" to match the Stage 2 prompt schema
    pantryItems: pantryItems.map((p) => ({
      ingredientName: p.name,
      quantity: p.quantity,
      unit: p.unit,
    })),
  })
}

// ─────────────────────────────────────────
// Response validators
// ─────────────────────────────────────────

interface MergedIngredient {
  ingredientName: string
  quantity: number | null
  unit: string | null
}

const validateStage1Result = (raw: unknown): MergedIngredient[] => {
  let arr: unknown = raw

  if (arr !== null && typeof arr === 'object' && !Array.isArray(arr)) {
    const obj = arr as Record<string, unknown>
    arr =
      obj['mergedIngredients'] ??
      obj['ingredients'] ??
      obj['items'] ??
      Object.values(obj)[0]
  }

  if (!Array.isArray(arr)) {
    throw new Error(
      `Stage 1: expected JSON array, got: ${JSON.stringify(raw).slice(0, 200)}`
    )
  }

  return (arr as any[])
    .filter(
      (item) =>
        item && typeof item.ingredientName === 'string' && item.ingredientName.trim()
    )
    .map((item) => ({
      ingredientName: String(item.ingredientName).trim(),
      quantity:
        item.quantity !== null && item.quantity !== undefined && item.quantity !== ''
          ? Number(item.quantity)
          : null,
      unit:
        item.unit && String(item.unit).trim() ? String(item.unit).trim() : null,
    }))
}

const validateStage2Result = (raw: unknown): AIAggregatedGroceryItem[] => {
  let arr: unknown = raw

  if (arr !== null && typeof arr === 'object' && !Array.isArray(arr)) {
    const obj = arr as Record<string, unknown>
    arr =
      obj['groceryItems'] ??
      obj['items'] ??
      obj['ingredients'] ??
      obj['groceryList'] ??
      Object.values(obj)[0]
  }

  if (!Array.isArray(arr)) {
    throw new Error(
      `Stage 2: expected JSON array, got: ${JSON.stringify(raw).slice(0, 200)}`
    )
  }

  return (arr as any[])
    .filter(
      (item) =>
        item && typeof item.ingredientName === 'string' && item.ingredientName.trim()
    )
    .map((item) => ({
      ingredientName: String(item.ingredientName).trim(),
      quantity:
        item.quantity !== null && item.quantity !== undefined && item.quantity !== ''
          ? Number(item.quantity)
          : null,
      unit:
        item.unit && String(item.unit).trim() ? String(item.unit).trim() : null,
      category: VALID_CATEGORIES.has(item.category) ? item.category : 'Other',
      note:
        item.note && String(item.note).trim() ? String(item.note).trim() : null,
    }))
}

// ─────────────────────────────────────────
// Rule-based pre-merge
// ─────────────────────────────────────────

const LEADING_WORDS = new Set([
  'boneless', 'skinless', 'lean', 'extra', 'fresh', 'raw', 'frozen',
  'dried', 'organic', 'baby', 'large', 'small', 'medium', 'reduced',
  'fat-free', 'low-fat', 'ground',
])

const TRAILING_FORM_WORDS = new Set([
  'leaves', 'leaf', 'cloves', 'clove', 'florets', 'floret',
  'stalks', 'stalk', 'sprigs', 'sprig',
])

const UNIT_ALIASES: Record<string, string> = {
  gram: 'g', grams: 'g', kilogram: 'kg', kilograms: 'kg', kilo: 'kg', kilos: 'kg',
  milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  pound: 'lb', pounds: 'lb', lbs: 'lb',
  ounce: 'oz', ounces: 'oz',
  tablespoon: 'tbsp', tablespoons: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp',
  piece: 'pcs', pieces: 'pcs', pc: 'pcs',
  cup: 'cups',
}

function normalizeName(n: string): string {
  let s = n
    .toLowerCase()
    .trim()
    .replace(/\([^)]*\)/g, '')
    .replace(/,.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  const words = s.split(' ')

  while (words.length > 1 && LEADING_WORDS.has(words[0])) words.shift()
  while (words.length > 1 && TRAILING_FORM_WORDS.has(words[words.length - 1])) words.pop()

  const last = words[words.length - 1]
  if (last.endsWith('s') && last.length > 3 && !last.endsWith('ss')) {
    words[words.length - 1] = last.slice(0, -1)
  }

  return words.join(' ').trim()
}

function normalizeUnit(u: string | null | undefined): string {
  if (!u) return ''
  const l = u.toLowerCase().trim()
  return UNIT_ALIASES[l] ?? l
}

function preMerge(ingredients: RawRecipeIngredient[]): RawRecipeIngredient[] {
  const map = new Map<string, RawRecipeIngredient>()

  for (const ing of ingredients) {
    const key = `${normalizeName(ing.name)}|${normalizeUnit(ing.unit)}`
    const existing = map.get(key)

    if (existing) {
      if (existing.quantity !== null && ing.quantity !== null) {
        existing.quantity = existing.quantity + ing.quantity
      }
    } else {
      map.set(key, { ...ing })
    }
  }

  return Array.from(map.values())
}

// ─────────────────────────────────────────
// Public API
// ─────────────────────────────────────────

export const aggregateGroceryList = async (
  recipeIngredients: RawRecipeIngredient[],
  pantryItems: RawPantryItem[]
): Promise<AIAggregatedGroceryItem[]> => {

  if (recipeIngredients.length === 0) return []

  // Step 0: Rule-based pre-merge
  const premerged = preMerge(recipeIngredients)

  // Stage 1: AI normalise & merge
  const stage1Raw = await sendAIMessageJSON<unknown>({
    systemPrompt: NORMALISE_AND_MERGE_PROMPT,
    userMessage: buildStage1Message(premerged),
    maxTokens: TOKEN_LIMITS.groceryAggregator,
  })

  const mergedIngredients = validateStage1Result(stage1Raw)

  if (mergedIngredients.length === 0) return []

  // Stage 2: AI pantry subtraction & categorisation
  const stage2Raw = await sendAIMessageJSON<unknown>({
    systemPrompt: PANTRY_SUBTRACT_AND_CATEGORISE_PROMPT,
    userMessage: buildStage2Message(mergedIngredients, pantryItems),
    maxTokens: TOKEN_LIMITS.groceryAggregator,
  })

  const result = validateStage2Result(stage2Raw)

  return result
}
