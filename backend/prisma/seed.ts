// ─────────────────────────────────────────
// Seed Script — What to Cook?
//
// Populates the database with a curated set
// of starter recipes so the app isn't empty
// on first launch.
//
// Run: npx ts-node prisma/seed.ts
// ─────────────────────────────────────────

import { prisma } from '../src/lib/prisma'

const recipes = [
  // ── Italian ───────────────────────────
  {
    title: 'Spaghetti Carbonara',
    description:
      'A classic Roman pasta dish made with eggs, Pecorino Romano, guanciale, and black pepper. Silky, rich, and deeply satisfying with no cream needed.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    calories: 620,
    protein: 28,
    carbs: 72,
    fat: 24,
    cuisine: 'Italian',
    dietType: 'NONE' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Spaghetti', quantity: 200, unit: 'g' },
      { ingredientName: 'Guanciale or pancetta', quantity: 150, unit: 'g' },
      { ingredientName: 'Eggs', quantity: 3, unit: 'whole' },
      { ingredientName: 'Pecorino Romano', quantity: 60, unit: 'g' },
      { ingredientName: 'Black pepper', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Salt', quantity: 1, unit: 'tsp' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Bring a large pot of salted water to a boil and cook spaghetti until al dente. Reserve 1 cup of pasta water before draining.' },
      { stepNumber: 2, instructionText: 'While pasta cooks, cut guanciale into small cubes and fry in a large pan over medium heat until crispy. Remove from heat.' },
      { stepNumber: 3, instructionText: 'In a bowl, whisk together eggs, finely grated Pecorino Romano, and a generous amount of black pepper.' },
      { stepNumber: 4, instructionText: 'Add hot drained pasta to the pan with guanciale (off the heat). Add egg mixture and toss quickly, adding splashes of pasta water to create a creamy sauce.' },
      { stepNumber: 5, instructionText: 'Serve immediately topped with extra Pecorino and black pepper.' },
    ],
  },

  // ── Mediterranean ─────────────────────
  {
    title: 'Greek Chicken Souvlaki Bowl',
    description:
      'Juicy marinated chicken skewers served over fluffy rice with tzatziki, crisp cucumber, cherry tomatoes, and warm flatbread. Fresh, bright, and protein-packed.',
    prepTimeMinutes: 20,
    cookTimeMinutes: 15,
    servings: 2,
    calories: 540,
    protein: 42,
    carbs: 48,
    fat: 16,
    cuisine: 'Mediterranean',
    dietType: 'NONE' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Chicken breast', quantity: 400, unit: 'g' },
      { ingredientName: 'Olive oil', quantity: 3, unit: 'tbsp' },
      { ingredientName: 'Lemon juice', quantity: 2, unit: 'tbsp' },
      { ingredientName: 'Garlic cloves', quantity: 3, unit: 'cloves' },
      { ingredientName: 'Dried oregano', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Greek yoghurt', quantity: 200, unit: 'g' },
      { ingredientName: 'Cucumber', quantity: 0.5, unit: 'whole' },
      { ingredientName: 'Cherry tomatoes', quantity: 150, unit: 'g' },
      { ingredientName: 'Cooked rice', quantity: 300, unit: 'g' },
      { ingredientName: 'Salt and pepper', quantity: 1, unit: 'pinch' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Cut chicken into 3cm chunks. Marinate with olive oil, lemon juice, minced garlic, oregano, salt, and pepper for at least 15 minutes.' },
      { stepNumber: 2, instructionText: 'Thread chicken onto skewers and cook on a hot griddle pan or grill for 6–8 minutes, turning occasionally, until charred and cooked through.' },
      { stepNumber: 3, instructionText: 'Make tzatziki by grating and squeezing cucumber dry, then mixing with yoghurt, a clove of minced garlic, and a squeeze of lemon.' },
      { stepNumber: 4, instructionText: 'Assemble bowls with rice, chicken skewers, halved cherry tomatoes, and a generous spoonful of tzatziki.' },
    ],
  },

  // ── Asian ─────────────────────────────
  {
    title: 'Teriyaki Salmon with Sesame Rice',
    description:
      'Flaky salmon fillets glazed with a sweet-savoury teriyaki sauce, served alongside sesame-flecked rice and blanched tenderstem broccoli.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 2,
    calories: 580,
    protein: 38,
    carbs: 55,
    fat: 20,
    cuisine: 'Japanese',
    dietType: 'NONE' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Salmon fillets', quantity: 2, unit: 'fillets' },
      { ingredientName: 'Soy sauce', quantity: 3, unit: 'tbsp' },
      { ingredientName: 'Mirin', quantity: 2, unit: 'tbsp' },
      { ingredientName: 'Honey', quantity: 1, unit: 'tbsp' },
      { ingredientName: 'Garlic', quantity: 1, unit: 'clove' },
      { ingredientName: 'Ginger', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Jasmine rice', quantity: 180, unit: 'g' },
      { ingredientName: 'Sesame oil', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Sesame seeds', quantity: 1, unit: 'tbsp' },
      { ingredientName: 'Tenderstem broccoli', quantity: 150, unit: 'g' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Cook jasmine rice according to packet instructions. Stir in sesame oil and half the sesame seeds when done.' },
      { stepNumber: 2, instructionText: 'Mix soy sauce, mirin, honey, grated garlic, and ginger in a small bowl to make the teriyaki glaze.' },
      { stepNumber: 3, instructionText: 'Heat an oven-proof pan over high heat. Sear salmon skin-side up for 2 minutes, flip, brush with glaze, and transfer to 200°C oven for 8 minutes.' },
      { stepNumber: 4, instructionText: 'Blanch broccoli in boiling salted water for 3 minutes, drain.' },
      { stepNumber: 5, instructionText: 'Plate rice, salmon, and broccoli. Drizzle remaining glaze over salmon and finish with sesame seeds.' },
    ],
  },

  // ── Vegetarian ────────────────────────
  {
    title: 'Roasted Red Pepper Pasta',
    description:
      'Smoky roasted red peppers blended into a velvety sauce with garlic, walnuts, and a hint of smoked paprika. A vegetarian weeknight classic that comes together in 30 minutes.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 25,
    servings: 3,
    calories: 490,
    protein: 14,
    carbs: 78,
    fat: 14,
    cuisine: 'Italian',
    dietType: 'VEGETARIAN' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Penne pasta', quantity: 300, unit: 'g' },
      { ingredientName: 'Roasted red peppers (jar)', quantity: 350, unit: 'g' },
      { ingredientName: 'Garlic cloves', quantity: 4, unit: 'cloves' },
      { ingredientName: 'Walnuts', quantity: 40, unit: 'g' },
      { ingredientName: 'Smoked paprika', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Olive oil', quantity: 2, unit: 'tbsp' },
      { ingredientName: 'Parmesan', quantity: 30, unit: 'g' },
      { ingredientName: 'Fresh basil', quantity: 1, unit: 'handful' },
      { ingredientName: 'Salt and pepper', quantity: 1, unit: 'pinch' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Cook pasta in well-salted boiling water until al dente. Reserve 200ml pasta water.' },
      { stepNumber: 2, instructionText: 'Blend roasted peppers, walnuts, garlic, smoked paprika, and olive oil until smooth. Season with salt and pepper.' },
      { stepNumber: 3, instructionText: 'Pour sauce into a large pan over medium heat. Loosen with pasta water until it coats the back of a spoon.' },
      { stepNumber: 4, instructionText: 'Toss drained pasta through the sauce. Serve topped with grated Parmesan and fresh basil.' },
    ],
  },

  // ── Indian ─────────────────────────────
  {
    title: 'Chicken Tikka Masala',
    description:
      'Tender marinated chicken in a rich, aromatic tomato-cream sauce with warming spices. This British-Indian favourite is comfort food at its finest. Serve with basmati rice or naan.',
    prepTimeMinutes: 20,
    cookTimeMinutes: 35,
    servings: 4,
    calories: 510,
    protein: 36,
    carbs: 28,
    fat: 28,
    cuisine: 'Indian',
    dietType: 'NONE' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Chicken thighs (boneless)', quantity: 700, unit: 'g' },
      { ingredientName: 'Full-fat yoghurt', quantity: 150, unit: 'g' },
      { ingredientName: 'Garam masala', quantity: 2, unit: 'tsp' },
      { ingredientName: 'Ground cumin', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Turmeric', quantity: 0.5, unit: 'tsp' },
      { ingredientName: 'Garlic cloves', quantity: 5, unit: 'cloves' },
      { ingredientName: 'Fresh ginger', quantity: 2, unit: 'cm piece' },
      { ingredientName: 'Butter', quantity: 30, unit: 'g' },
      { ingredientName: 'Onion', quantity: 1, unit: 'large' },
      { ingredientName: 'Tinned tomatoes', quantity: 400, unit: 'g' },
      { ingredientName: 'Double cream', quantity: 100, unit: 'ml' },
      { ingredientName: 'Fresh coriander', quantity: 1, unit: 'handful' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Mix yoghurt with 1 tsp garam masala, cumin, turmeric, half the garlic, and ginger. Coat chicken pieces in marinade and refrigerate for at least 1 hour (or overnight).' },
      { stepNumber: 2, instructionText: 'Grill or pan-fry marinated chicken over high heat until slightly charred. Set aside.' },
      { stepNumber: 3, instructionText: 'Melt butter in a deep pan. Fry diced onion for 8 minutes until golden. Add remaining garlic and ginger, cook 1 minute.' },
      { stepNumber: 4, instructionText: 'Add remaining garam masala and tinned tomatoes. Simmer 15 minutes until thickened. Blend if you prefer a smooth sauce.' },
      { stepNumber: 5, instructionText: 'Stir in cream and cooked chicken. Simmer 5 minutes. Garnish with coriander and serve with basmati rice.' },
    ],
  },

  // ── Vegan ─────────────────────────────
  {
    title: 'Thai Green Curry (Vegan)',
    description:
      'Fragrant coconut milk curry packed with tofu, courgette, baby corn, and spinach in a vibrant green curry paste. Ready in 25 minutes and bursting with fresh lemongrass and lime flavour.',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 3,
    calories: 420,
    protein: 16,
    carbs: 32,
    fat: 26,
    cuisine: 'Thai',
    dietType: 'VEGAN' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Firm tofu', quantity: 400, unit: 'g' },
      { ingredientName: 'Coconut milk', quantity: 400, unit: 'ml' },
      { ingredientName: 'Vegan green curry paste', quantity: 3, unit: 'tbsp' },
      { ingredientName: 'Courgette', quantity: 1, unit: 'medium' },
      { ingredientName: 'Baby corn', quantity: 100, unit: 'g' },
      { ingredientName: 'Spinach', quantity: 80, unit: 'g' },
      { ingredientName: 'Vegetable stock', quantity: 200, unit: 'ml' },
      { ingredientName: 'Lime', quantity: 1, unit: 'whole' },
      { ingredientName: 'Soy sauce', quantity: 1, unit: 'tbsp' },
      { ingredientName: 'Fresh basil', quantity: 1, unit: 'handful' },
      { ingredientName: 'Jasmine rice', quantity: 240, unit: 'g' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Press tofu dry with kitchen paper, then cube and pan-fry until golden on all sides. Set aside.' },
      { stepNumber: 2, instructionText: 'Cook jasmine rice according to packet instructions.' },
      { stepNumber: 3, instructionText: 'In a wok, fry green curry paste in 1 tbsp oil for 1 minute until fragrant. Pour in coconut milk and stock, stir well.' },
      { stepNumber: 4, instructionText: 'Add courgette and baby corn. Simmer 8 minutes. Add tofu and spinach, cook 2 more minutes.' },
      { stepNumber: 5, instructionText: 'Season with soy sauce and lime juice. Scatter basil over the top and serve with rice.' },
    ],
  },

  // ── Keto ──────────────────────────────
  {
    title: 'Pan-Seared Steak with Garlic Butter Mushrooms',
    description:
      'A perfectly seared ribeye steak rested and served with a rich garlic herb butter and sautéed wild mushrooms. High protein, zero carb, and deeply satisfying.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    servings: 1,
    calories: 680,
    protein: 52,
    carbs: 4,
    fat: 48,
    cuisine: 'American',
    dietType: 'KETO' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Ribeye steak', quantity: 300, unit: 'g' },
      { ingredientName: 'Butter', quantity: 40, unit: 'g' },
      { ingredientName: 'Garlic cloves', quantity: 3, unit: 'cloves' },
      { ingredientName: 'Fresh thyme', quantity: 3, unit: 'sprigs' },
      { ingredientName: 'Mixed wild mushrooms', quantity: 200, unit: 'g' },
      { ingredientName: 'Olive oil', quantity: 1, unit: 'tbsp' },
      { ingredientName: 'Salt and black pepper', quantity: 1, unit: 'pinch' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Pat steak completely dry with kitchen paper. Season generously with salt and pepper on both sides. Leave at room temperature 10 minutes.' },
      { stepNumber: 2, instructionText: 'Heat a cast-iron pan until smoking hot. Add oil and sear steak 2–3 minutes per side for medium-rare. Add butter, garlic, and thyme, basting steak continuously for 1 minute.' },
      { stepNumber: 3, instructionText: 'Rest steak on a board for 5 minutes (crucial for juicy results).' },
      { stepNumber: 4, instructionText: 'In the same pan, fry mushrooms over high heat until golden. Season with salt and pepper.' },
      { stepNumber: 5, instructionText: 'Slice steak against the grain and plate with mushrooms and any resting juices.' },
    ],
  },

  // ── Mexican ───────────────────────────
  {
    title: 'Black Bean & Sweet Potato Tacos',
    description:
      'Smoky roasted sweet potato and spiced black beans piled into warm corn tortillas with avocado crema, pickled red onion, and fresh coriander. A vegan crowd-pleaser.',
    prepTimeMinutes: 15,
    cookTimeMinutes: 25,
    servings: 2,
    calories: 480,
    protein: 14,
    carbs: 68,
    fat: 18,
    cuisine: 'Mexican',
    dietType: 'VEGAN' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Sweet potatoes', quantity: 400, unit: 'g' },
      { ingredientName: 'Tinned black beans', quantity: 400, unit: 'g' },
      { ingredientName: 'Corn tortillas', quantity: 8, unit: 'small' },
      { ingredientName: 'Ripe avocado', quantity: 1, unit: 'whole' },
      { ingredientName: 'Lime', quantity: 2, unit: 'whole' },
      { ingredientName: 'Red onion', quantity: 1, unit: 'small' },
      { ingredientName: 'Smoked paprika', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Cumin', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Chipotle chilli flakes', quantity: 0.5, unit: 'tsp' },
      { ingredientName: 'Fresh coriander', quantity: 1, unit: 'handful' },
      { ingredientName: 'Olive oil', quantity: 2, unit: 'tbsp' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Dice sweet potatoes into 1.5cm cubes. Toss with olive oil, smoked paprika, cumin, and chilli flakes. Roast at 200°C for 25 minutes until caramelised.' },
      { stepNumber: 2, instructionText: 'Quick-pickle red onion by slicing thinly and soaking in lime juice with a pinch of salt for 15 minutes.' },
      { stepNumber: 3, instructionText: 'Drain and rinse black beans. Warm in a pan with a pinch of cumin and salt for 3 minutes.' },
      { stepNumber: 4, instructionText: 'Mash avocado with lime juice and a pinch of salt for the crema.' },
      { stepNumber: 5, instructionText: 'Warm tortillas directly over a gas flame or in a dry pan. Fill with sweet potato, black beans, avocado crema, pickled onion, and coriander.' },
    ],
  },

  // ── High-protein breakfast ─────────────
  {
    title: 'Smoked Salmon & Egg White Omelette',
    description:
      'A light, protein-dense omelette filled with smoked salmon, cream cheese, and fresh dill. Ready in under 10 minutes and perfect for a high-protein start to the day.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 8,
    servings: 1,
    calories: 320,
    protein: 38,
    carbs: 4,
    fat: 16,
    cuisine: 'British',
    dietType: 'NONE' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Egg whites', quantity: 5, unit: 'whole' },
      { ingredientName: 'Smoked salmon', quantity: 80, unit: 'g' },
      { ingredientName: 'Cream cheese (light)', quantity: 30, unit: 'g' },
      { ingredientName: 'Fresh dill', quantity: 1, unit: 'small bunch' },
      { ingredientName: 'Capers', quantity: 1, unit: 'tbsp' },
      { ingredientName: 'Olive oil', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Salt and white pepper', quantity: 1, unit: 'pinch' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Whisk egg whites with a pinch of salt and white pepper until lightly frothy.' },
      { stepNumber: 2, instructionText: 'Heat oil in a non-stick pan over medium heat. Pour in egg whites and cook undisturbed for 2 minutes until edges are set.' },
      { stepNumber: 3, instructionText: 'Gently push cooked edges to the centre, tilting the pan to let raw egg flow underneath. Cook until just set but still glossy.' },
      { stepNumber: 4, instructionText: 'Dot cream cheese, smoked salmon, capers, and dill over one half. Fold the omelette over the filling.' },
      { stepNumber: 5, instructionText: 'Slide onto a plate and serve immediately with lemon wedges if desired.' },
    ],
  },

  // ── Healthy bowl ──────────────────────
  {
    title: 'Quinoa Power Bowl',
    description:
      'A nourishing bowl of fluffy quinoa topped with roasted chickpeas, avocado, kale, roasted sweet potato, and a tahini-lemon dressing. Completely vegan and packed with plant protein.',
    prepTimeMinutes: 15,
    cookTimeMinutes: 30,
    servings: 2,
    calories: 520,
    protein: 20,
    carbs: 62,
    fat: 22,
    cuisine: 'Mediterranean',
    dietType: 'VEGAN' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Quinoa', quantity: 180, unit: 'g' },
      { ingredientName: 'Tinned chickpeas', quantity: 400, unit: 'g' },
      { ingredientName: 'Sweet potato', quantity: 300, unit: 'g' },
      { ingredientName: 'Kale', quantity: 100, unit: 'g' },
      { ingredientName: 'Avocado', quantity: 1, unit: 'whole' },
      { ingredientName: 'Tahini', quantity: 2, unit: 'tbsp' },
      { ingredientName: 'Lemon', quantity: 1, unit: 'whole' },
      { ingredientName: 'Garlic', quantity: 1, unit: 'clove' },
      { ingredientName: 'Smoked paprika', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Olive oil', quantity: 2, unit: 'tbsp' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Cook quinoa in 360ml salted water for 15 minutes until water is absorbed. Fluff with a fork.' },
      { stepNumber: 2, instructionText: 'Drain and pat dry chickpeas. Toss with oil, smoked paprika, and salt. Roast at 200°C for 25 minutes until crispy.' },
      { stepNumber: 3, instructionText: 'Cube sweet potato, toss with oil and salt, roast alongside chickpeas for 25 minutes.' },
      { stepNumber: 4, instructionText: 'Massage kale with a tiny pinch of salt and a squeeze of lemon until softened.' },
      { stepNumber: 5, instructionText: 'Whisk tahini, lemon juice, minced garlic, and 2 tbsp water for the dressing.' },
      { stepNumber: 6, instructionText: 'Assemble bowls: quinoa base, topped with chickpeas, sweet potato, kale, and sliced avocado. Drizzle dressing generously.' },
    ],
  },

  // ── Quick & easy ─────────────────────
  {
    title: 'Creamy Tomato & Spinach Gnocchi',
    description:
      'Pillowy shop-bought gnocchi smothered in a quick creamy tomato sauce with wilted spinach and fresh basil. On the table in 20 minutes with minimal washing up.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 15,
    servings: 2,
    calories: 560,
    protein: 16,
    carbs: 80,
    fat: 18,
    cuisine: 'Italian',
    dietType: 'VEGETARIAN' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Fresh gnocchi (shop-bought)', quantity: 500, unit: 'g' },
      { ingredientName: 'Tinned chopped tomatoes', quantity: 400, unit: 'g' },
      { ingredientName: 'Garlic cloves', quantity: 3, unit: 'cloves' },
      { ingredientName: 'Double cream', quantity: 100, unit: 'ml' },
      { ingredientName: 'Baby spinach', quantity: 80, unit: 'g' },
      { ingredientName: 'Parmesan', quantity: 30, unit: 'g' },
      { ingredientName: 'Olive oil', quantity: 1, unit: 'tbsp' },
      { ingredientName: 'Dried chilli flakes', quantity: 0.5, unit: 'tsp' },
      { ingredientName: 'Fresh basil', quantity: 1, unit: 'handful' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Heat olive oil in a large pan. Add minced garlic and chilli flakes, fry for 30 seconds.' },
      { stepNumber: 2, instructionText: 'Pour in tinned tomatoes and simmer for 8 minutes until slightly reduced. Stir in cream and season well.' },
      { stepNumber: 3, instructionText: 'Meanwhile, cook gnocchi in boiling salted water until they float (about 2 minutes). Drain.' },
      { stepNumber: 4, instructionText: 'Add gnocchi and spinach to the sauce. Toss until spinach wilts, about 1 minute.' },
      { stepNumber: 5, instructionText: 'Serve in warm bowls topped with grated Parmesan and torn basil.' },
    ],
  },

  // ── Breakfast / Paleo ─────────────────
  {
    title: 'Avocado & Poached Egg on Sourdough',
    description:
      'Perfectly poached eggs on crushed avocado toast with a drizzle of chilli oil, lemon zest, and flaky sea salt on thick-cut sourdough. The ultimate brunch staple.',
    prepTimeMinutes: 5,
    cookTimeMinutes: 10,
    servings: 1,
    calories: 430,
    protein: 18,
    carbs: 38,
    fat: 24,
    cuisine: 'British',
    dietType: 'VEGETARIAN' as const,
    isAiGenerated: false,
    ingredients: [
      { ingredientName: 'Sourdough bread', quantity: 2, unit: 'thick slices' },
      { ingredientName: 'Ripe avocado', quantity: 1, unit: 'whole' },
      { ingredientName: 'Eggs', quantity: 2, unit: 'whole' },
      { ingredientName: 'Lemon', quantity: 0.5, unit: 'whole' },
      { ingredientName: 'Chilli oil', quantity: 1, unit: 'tsp' },
      { ingredientName: 'Flaky sea salt', quantity: 1, unit: 'pinch' },
      { ingredientName: 'White wine vinegar', quantity: 1, unit: 'tbsp' },
      { ingredientName: 'Fresh chives', quantity: 1, unit: 'small bunch' },
    ],
    steps: [
      { stepNumber: 1, instructionText: 'Toast sourdough slices until golden and crisp.' },
      { stepNumber: 2, instructionText: 'Bring a deep pan of water to a gentle simmer with white wine vinegar. Create a gentle swirl, crack eggs in one at a time, and poach for 3 minutes for a runny yolk.' },
      { stepNumber: 3, instructionText: 'Scoop avocado into a bowl. Add lemon juice, flaky salt, and a pinch of pepper. Crush gently — keep it chunky.' },
      { stepNumber: 4, instructionText: 'Spread avocado thickly on toast. Top each slice with a poached egg.' },
      { stepNumber: 5, instructionText: 'Finish with chilli oil, extra sea salt, lemon zest, and snipped chives.' },
    ],
  },
]

async function main() {
  console.log('🌱 Seeding recipes...')

  let created = 0
  let skipped = 0

  for (const recipe of recipes) {
    // Skip if a recipe with this title already exists
    const existing = await prisma.recipe.findFirst({
      where: { title: recipe.title },
    })

    if (existing) {
      console.log(`  ⏭  Skipped (already exists): ${recipe.title}`)
      skipped++
      continue
    }

    const { ingredients, steps, ...recipeData } = recipe

    await prisma.recipe.create({
      data: {
        ...recipeData,
        createdByUserId: null,
        ingredients: {
          create: ingredients.map((ing) => ({
            ingredientName: ing.ingredientName,
            quantity: ing.quantity,
            unit: ing.unit,
          })),
        },
        steps: {
          create: steps,
        },
      },
    })

    console.log(`  ✅ Created: ${recipe.title}`)
    created++
  }

  console.log(`\n🎉 Done — ${created} recipes created, ${skipped} skipped.`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
