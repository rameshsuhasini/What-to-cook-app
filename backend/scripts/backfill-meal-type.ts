/**
 * One-time script: backfill mealType on existing recipes
 * using keyword matching on titles.
 *
 * Run with:  npx ts-node --skip-project scripts/backfill-meal-type.ts
 */

import { MealType } from '@prisma/client'
import { prisma } from '../src/lib/prisma'

const BREAKFAST_KEYWORDS = [
  'breakfast', 'egg', 'eggs', 'omelette', 'omelet', 'pancake', 'waffle',
  'toast', 'oatmeal', 'porridge', 'smoothie', 'cereal', 'granola', 'muffin',
  'frittata', 'benedict', 'scrambled', 'french toast',
]

const LUNCH_KEYWORDS = [
  'lunch', 'sandwich', 'wrap', 'salad', 'soup', 'bowl', 'pita', 'quesadilla',
  'taco', 'burrito', 'sub', 'club', 'blt', 'panini', 'flatbread',
]

const SNACK_KEYWORDS = [
  'snack', 'dip', 'hummus', 'chips', 'cookie', 'bar', 'bite', 'popcorn',
  'guacamole', 'bruschetta', 'nachos', 'trail mix',
]

const DINNER_KEYWORDS = [
  'dinner', 'curry', 'roast', 'steak', 'chicken', 'beef', 'lamb', 'pork',
  'fish', 'salmon', 'pasta', 'risotto', 'casserole', 'stew', 'bake', 'baked',
  'grilled', 'bbq', 'barbecue', 'tikka', 'masala', 'biryani', 'pilaf',
  'lasagne', 'lasagna', 'bolognese', 'carbonara', 'pie', 'burger', 'meatball',
  'shrimp', 'prawn', 'lobster', 'crab', 'sushi', 'stir fry', 'stir-fry',
]

function classify(title: string): MealType {
  const t = title.toLowerCase()

  if (BREAKFAST_KEYWORDS.some((k) => t.includes(k))) return 'BREAKFAST'
  if (SNACK_KEYWORDS.some((k) => t.includes(k)))     return 'SNACK'
  if (LUNCH_KEYWORDS.some((k) => t.includes(k)))     return 'LUNCH'
  if (DINNER_KEYWORDS.some((k) => t.includes(k)))    return 'DINNER'

  // Default unclassified to DINNER (most common meal type)
  return 'DINNER'
}

async function main() {
  const recipes = await prisma.recipe.findMany({
    where: { mealType: null },
    select: { id: true, title: true },
  })

  console.log(`Found ${recipes.length} recipes without mealType`)

  let updated = 0
  for (const recipe of recipes) {
    const mealType = classify(recipe.title)
    await prisma.recipe.update({
      where: { id: recipe.id },
      data: { mealType },
    })
    console.log(`  ${recipe.title} → ${mealType}`)
    updated++
  }

  console.log(`\nDone. Updated ${updated} recipes.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
