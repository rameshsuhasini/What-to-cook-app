# What to Cook? — Claude Project Memory

## Project Overview
AI-powered meal planning and nutrition assistant that helps users discover recipes,
plan weekly meals, generate grocery lists, track nutrition and weight, manage pantry
ingredients, and get AI-powered cooking and health recommendations.

---

⚠️ STANDING ORDERS — MUST FOLLOW WITHOUT EXCEPTION
These rules apply to EVERY single file built in this project — backend, frontend, AI layer, everything.
1. 🧱 Code Quality & Standards

Strict TypeScript everywhere — no any types, no shortcuts
Clean layered architecture strictly followed at all times
Every function has a single responsibility
Meaningful naming, inline comments for complex logic
No dead code, no console.logs in production paths
Use async/await only — no raw promises or callbacks
All API responses follow the standard format:

typescript  { success: true, data: {...} }       // success
  { success: false, message: "..." }   // error
2. 🔒 No Memory Leaks

Proper cleanup of all async operations
No dangling event listeners
Prisma connections managed via singleton pattern only
React useEffect always has cleanup functions where needed
No unclosed streams, timers, or subscriptions

3. 🛡️ Security First — Always

JWT stored in httpOnly cookies only — never localStorage
Input validation + sanitization on every single endpoint
Rate limiting on AI endpoints and auth endpoints
Helmet and CORS configured properly
No sensitive data in logs or API responses
SQL injection impossible — Prisma used for ALL DB operations
Passwords hashed with bcryptjs (12 salt rounds) — never stored plain
Never expose passwordHash in any response — always sanitize
XSS prevention enforced on frontend

4. 🏗️ Maintainability & Scalability

Feature-based folder structure — easy to add new modules
Reusable components and hooks on frontend
Environment-based config — never hardcode values
Clear separation of concerns at every layer
New modules must not require touching existing ones
Every new module follows the same patterns as existing ones

5. 🎨 Premium UI — NOT Typical Claude Black Theme

NEVER use flat black/grey AI aesthetic
Rich, carefully chosen color palette — warm and premium
Smooth animations using Framer Motion
Data visualizations: charts, progress rings, graphs where relevant
Micro-interactions and hover states throughout
Glassmorphism, gradients, high-end design language
Dashboard-quality layouts with real visual hierarchy
Typography must feel intentional and polished
Every screen must feel like a premium product, not a dev tool

6. 🎨 Color & Design Language

Premium, unique color palette — think luxury product
Warm rich tones — deep forest greens, warm ambers, rich purples, ocean blues
— something with personality and NOT generic
Consistent design tokens across the entire app
No generic whites and greys — every color must be intentional
Animations must be smooth, tasteful, and purposeful

7. 🏛️ Best Architecture & System Design

Backend: Layered architecture — routes → controller → service → repository → AI
Frontend: Feature-based structure with shared components
State management: React Query for server state, Zustand for client state
AI layer fully isolated and independently extensible
API contracts typed end-to-end
Built to scale from day one — no shortcuts that break later

## Tech Stack

### Frontend
- Next.js (App Router)
- React + TypeScript
- Tailwind CSS + Shadcn UI
- React Query (server state)
- Zustand (client state)
- Axios (HTTP client)

### Backend
- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL (Neon serverless)
- JWT Authentication
- bcryptjs (password hashing)

### AI
- Anthropic Claude API (`@anthropic-ai/sdk`)
- Model: `claude-sonnet-4-20250514`
- Dedicated AI service layer with prompt builders

### Infrastructure
- Database: Neon (serverless PostgreSQL)
- Cache: Redis (optional, future)

---

## Project Structure

```
what-to-cook/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── routes/
│   │   ├── repositories/
│   │   ├── middleware/
│   │   ├── ai/
│   │   │   ├── aiService.ts
│   │   │   ├── mealPlanAI.ts
│   │   │   ├── recipeGeneratorAI.ts
│   │   │   ├── healthInsightsAI.ts
│   │   │   └── pantrySuggestionsAI.ts
│   │   ├── prisma/
│   │   └── app.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── .env
├── frontend/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── services/
│   ├── hooks/
│   ├── store/
│   ├── types/
│   └── utils/
└── CLAUDE.md
```

---

## Architecture Pattern

```
Frontend (Next.js)
      ↓
Backend API (Node.js + Express)
      ↓
AI Service Layer (prompt builders)
      ↓
Anthropic Claude API
      ↓
PostgreSQL (Neon)
```

---

## Backend Architecture Rules
- Separate **controllers**, **services**, **routes**, and **repositories**
- Controllers handle HTTP request/response only
- Services contain all business logic
- Repositories handle all database operations via Prisma
- AI logic lives exclusively in the `ai/` service layer
- Never put business logic in routes

---

## API Structure

### Auth
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me

### Profile
- GET /api/profile
- PUT /api/profile

### Recipes
- GET /api/recipes
- GET /api/recipes/:id
- POST /api/recipes
- PUT /api/recipes/:id
- DELETE /api/recipes/:id
- POST /api/recipes/save
- DELETE /api/recipes/save/:id
- GET /api/recipes/saved

### Meal Planner
- GET /api/meal-plans/week
- POST /api/meal-plans
- PUT /api/meal-plans/:id
- DELETE /api/meal-plans/:id

### Groceries
- GET /api/groceries
- POST /api/groceries/generate
- PUT /api/groceries/item/:id
- DELETE /api/groceries/item/:id

### Pantry
- GET /api/pantry
- POST /api/pantry
- PUT /api/pantry/:id
- DELETE /api/pantry/:id

### Health
- GET /api/weight-logs
- POST /api/weight-logs
- GET /api/nutrition-logs
- POST /api/nutrition-logs

### AI Endpoints
- POST /api/ai/generate-meal-plan
- POST /api/ai/generate-recipe
- POST /api/ai/health-insights
- POST /api/ai/pantry-suggestions

---

## Database Entities
- users
- user_profiles
- recipes
- recipe_ingredients
- recipe_steps
- saved_recipes
- meal_plans
- meal_plan_items
- grocery_lists
- grocery_items
- pantry_items
- weight_logs
- nutrition_logs

---

## Key Relationships
- User has one Profile
- User has many MealPlans
- MealPlan has many MealPlanItems
- MealPlanItem belongs to a Recipe
- Recipe has many Ingredients and Steps
- GroceryList is generated from a MealPlan
- PantryItems belong to a User

---

## Environment Variables

### Backend (.env)
```
DATABASE_URL=           # Neon PostgreSQL connection string (pooled)
ANTHROPIC_API_KEY=      # Anthropic Claude API key
JWT_SECRET=             # Strong random string for JWT signing
PORT=5000
NODE_ENV=development
```

---

## Coding Conventions
- Always use TypeScript with strict types
- Use async/await (no raw promises or callbacks)
- All API responses follow this format:
```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, message: "Error description" }
```
- Use Prisma for ALL database operations — no raw SQL
- Validate all request inputs using express-validator
- Never expose password_hash in API responses
- Always handle errors with try/catch and pass to next(err)

---

## AI Service Rules
- All Claude API calls go through the AI service layer
- Each feature has its own prompt builder file
- Prompts must include user context (diet type, allergies, goals)
- AI responses must be parsed and validated before saving to DB
- Always set max_tokens appropriately per feature

---

## Security Rules
- JWT stored in httpOnly cookies (not localStorage)
- All protected routes use auth middleware
- Passwords hashed with bcryptjs (salt rounds: 12)
- Rate limit all AI endpoints (expensive calls)
- Sanitize all user inputs before DB operations
- Never log sensitive data (passwords, tokens, API keys)

---

## Frontend Pages
- /login
- /signup
- /dashboard
- /recipes
- /recipes/[id]
- /weekly-planner
- /groceries
- /pantry
- /progress
- /profile

---

## AI Features (Stage 1)
1. AI Recipe Generator — /recipes page
2. AI Weekly Meal Plan Generator — /weekly-planner page
3. AI Health Insights — /dashboard page
4. AI Pantry Recipe Suggestions — /pantry page

---

## Development Order
1. ✅ Project setup
2. ⬜ Backend entry point + Express app
3. ⬜ Prisma schema + DB connection
4. ⬜ Auth module
5. ⬜ Recipe module
6. ⬜ Meal planner module
7. ⬜ Grocery module
8. ⬜ Pantry module
9. ⬜ Health tracking module
10. ⬜ AI service layer
11. ⬜ Frontend application

---

## Notes
- Use pooled Neon connection string for Prisma in production
- Redis caching to be added in a future sprint for AI responses
- health_conditions, allergies, food_preferences stored as TEXT for now
  (can be normalized to separate tables in future if filtering is needed)
