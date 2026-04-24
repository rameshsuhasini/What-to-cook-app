# What to Cook? — Project Reference

## Live App
- **URL:** https://what-to-cook-app.vercel.app/login
- **Frontend hosting:** Vercel (auto-deploys from `main`)
- **Backend hosting:** Render

---

## Project Overview
AI-powered meal planning and nutrition assistant. Users can discover and generate recipes,
plan weekly meals, auto-generate grocery lists, track nutrition and weight, manage pantry
ingredients, and receive personalised AI-powered health recommendations.

---

## Features

### Authentication
- Signup / login / logout with email + password
- JWT stored in httpOnly cookies (never localStorage)
- Smart onboarding flow with TDEE auto-calculation (activity level + goal type)

### Dashboard
- Nutrition summary cards — calories, protein, carbs, fat with animated progress bars
- Weight trend chart (30-day area chart)
- Today's meals preview from weekly plan
- AI health insight — auto-generated daily, up to 3 manual refreshes per day
- Quick action tiles for common navigation

### Recipes
- Browse all recipes with pagination
- Save / unsave recipes (saved tab)
- AI recipe generator — generate by ingredients, cuisine, dietary preferences
- Recipe detail page with ingredients and steps

### Weekly Planner
- 7-day meal plan grid (Mon–Sun × Breakfast / Lunch / Dinner / Snack)
- AI weekly meal plan generator
- Assign recipes to slots, clear individual slots or full day
- Calorie and macro summary per day

### Groceries
- AI-generated grocery list from active meal plan
- Check off items as purchased
- Add / remove items manually

### Pantry
- Track ingredients with quantity, unit, and expiry date
- Category-based organisation and filtering
- Add / edit / delete items
- Low stock and expiry indicators

### Health & Progress
- Weight logging with 30-day trend chart
- Daily nutrition logging (calories + macros)
- Stats: current weight, total change, BMI

### Profile
- Dietary preferences, allergies, health conditions
- Calorie and macro goals
- Activity level and weight goal type

### Notifications & Achievements (DEV-32)
- Achievement system with milestone badges
- Notification bell in app header with unread count
- Achievement toast notifications on trigger events

---

## Tech Stack

### Frontend
- **Framework:** Next.js 16 (App Router) + React + TypeScript
- **Styling:** Tailwind CSS + custom CSS design tokens
- **UI Components:** Shadcn UI
- **Animations:** Framer Motion
- **Server state:** React Query (@tanstack/react-query)
- **Client state:** Zustand
- **HTTP client:** Axios
- **Charts:** Recharts

### Backend
- **Runtime:** Node.js 20.19.5 + Express + TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL via Neon (serverless)
- **Auth:** JWT (jsonwebtoken) + httpOnly cookies
- **Password hashing:** bcryptjs (12 salt rounds)
- **Validation:** express-validator
- **Security:** Helmet, CORS, rate-limiting

### AI
- **SDK:** @anthropic-ai/sdk
- **Model:** `claude-sonnet-4-20250514`
- Dedicated AI service layer with per-feature prompt builders

### Infrastructure
- **Frontend hosting:** Vercel (auto-deploys from `main`)
- **Database:** Neon serverless PostgreSQL
- **Cache:** Redis *(planned — not yet implemented)*

---

## Local Setup

### Prerequisites
- Node.js **v20.19.5**
- npm v10+
- A [Neon](https://neon.tech) database (free tier works)
- An [Anthropic](https://console.anthropic.com) API key

### 1 — Clone the repo
```bash
git clone <repo-url>
cd what-to-cook-app
```

### 2 — Backend setup
```bash
cd backend
npm install
```

Create `backend/.env` (see Environment Variables section below) then:

```bash
npm run prisma:generate     # generate Prisma client
npm run prisma:migrate      # run migrations against Neon DB
npm run dev                 # starts on http://localhost:5000
```

### 3 — Frontend setup
```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Then:
```bash
npm run dev                 # starts on http://localhost:3000
```

### 4 — Open in browser
Navigate to **http://localhost:3000** — sign up for a new account, complete onboarding.

---

## Environment Variables

### Backend — `backend/.env`
```
DATABASE_URL=               # Neon PostgreSQL pooled connection string
ANTHROPIC_API_KEY=          # Anthropic Claude API key
JWT_SECRET=                 # Strong random string (min 32 chars)
PORT=5000
NODE_ENV=development
```

### Frontend — `frontend/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Database

- **Provider:** [Neon](https://neon.tech) — serverless PostgreSQL
- **ORM:** Prisma — schema lives at `backend/prisma/schema.prisma`
- **Pooled connection string** required for Prisma in production (Neon provides both direct + pooled)

### Useful DB commands
```bash
npm run prisma:migrate      # apply pending migrations
npm run prisma:push         # push schema changes without migration file (dev only)
npm run prisma:studio       # open Prisma Studio GUI at http://localhost:5555
npm run prisma:generate     # regenerate Prisma client after schema changes
```

### Entities
`users` · `user_profiles` · `recipes` · `recipe_ingredients` · `recipe_steps` ·
`saved_recipes` · `meal_plans` · `meal_plan_items` · `grocery_lists` · `grocery_items` ·
`pantry_items` · `weight_logs` · `nutrition_logs`

---

## Git Branching

- **Main branch:** `main` — production, auto-deploys to Vercel
- **Feature branches:** `DEV-<ticket-number>-short-description`
  - Example: `DEV-45-UI-Polish-Small-Fixes`
- PRs always target `main`
- Merge `main` into feature branch before raising PR to avoid conflicts

---

## Deployment

### Frontend (Vercel)
- Auto-deploys on push to `main`
- Set `NEXT_PUBLIC_API_URL` in Vercel project environment variables

### Backend
- Set all backend `.env` keys in your hosting provider's environment config
- Use the **pooled** Neon connection string for `DATABASE_URL` in production
- Run `npm run prisma:migrate` as part of your deploy pipeline

---

## Roadmap / Known Gaps
- **DEV-46:** Recipe serving size scaler
- **DEV-47:** Progress page UI revamp
- **Redis caching:** AI response caching (deferred — not yet implemented)
- **Email verification:** Not implemented — any email format accepted at signup
- `health_conditions`, `allergies`, `food_preferences` stored as plain TEXT
  (can be normalised to lookup tables if filtering/search is needed later)

---

⚠️ STANDING ORDERS — MUST FOLLOW WITHOUT EXCEPTION
These rules apply to EVERY single file built in this project — backend, frontend, AI layer, everything.

### 1. Code Quality & Standards
- Strict TypeScript everywhere — no `any` types, no shortcuts
- Clean layered architecture strictly followed at all times
- Every function has a single responsibility
- Meaningful naming, inline comments for complex logic only
- No dead code, no `console.log` in production paths
- Use `async/await` only — no raw promises or callbacks
- All API responses follow the standard format:
```typescript
{ success: true,  data: {...}       }   // success
{ success: false, message: "..."   }   // error
```

### 2. No Memory Leaks
- Proper cleanup of all async operations
- No dangling event listeners
- Prisma connections managed via singleton pattern only
- React `useEffect` always has cleanup functions where needed
- No unclosed streams, timers, or subscriptions

### 3. Security First — Always
- JWT stored in httpOnly cookies only — never localStorage
- Input validation + sanitisation on every single endpoint
- Rate limiting on AI endpoints and auth endpoints
- Helmet and CORS configured properly
- No sensitive data in logs or API responses
- SQL injection impossible — Prisma used for ALL DB operations
- Passwords hashed with bcryptjs (12 salt rounds) — never stored plain
- Never expose `passwordHash` in any response — always sanitise
- XSS prevention enforced on frontend

### 4. Maintainability & Scalability
- Feature-based folder structure — easy to add new modules
- Reusable components and hooks on frontend
- Environment-based config — never hardcode values
- Clear separation of concerns at every layer
- New modules must not require touching existing ones
- Every new module follows the same patterns as existing ones

### 5. Premium UI — NOT Typical Claude Black Theme
- NEVER use flat black/grey AI aesthetic
- Rich, carefully chosen colour palette — warm and premium
- Smooth animations using Framer Motion
- Data visualisations: charts, progress rings, graphs where relevant
- Micro-interactions and hover states throughout
- Glassmorphism, gradients, high-end design language
- Dashboard-quality layouts with real visual hierarchy
- Typography must feel intentional and polished
- Every screen must feel like a premium product, not a dev tool

### 6. Color & Design Language
- Premium, unique colour palette — think luxury product
- Warm rich tones — deep forest greens, warm ambers, rich purples, ocean blues
- Consistent design tokens across the entire app
- No generic whites and greys — every colour must be intentional
- Animations must be smooth, tasteful, and purposeful

### 7. Best Architecture & System Design
- Backend: Layered architecture — routes → controller → service → repository → AI
- Frontend: Feature-based structure with shared components
- State management: React Query for server state, Zustand for client state
- AI layer fully isolated and independently extensible
- API contracts typed end-to-end
- Built to scale from day one — no shortcuts that break later

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
- GET  /api/auth/me

### Profile
- GET /api/profile
- PUT /api/profile

### Recipes
- GET    /api/recipes
- GET    /api/recipes/:id
- POST   /api/recipes
- PUT    /api/recipes/:id
- DELETE /api/recipes/:id
- POST   /api/recipes/save
- DELETE /api/recipes/save/:id
- GET    /api/recipes/saved

### Meal Planner
- GET    /api/meal-plans/week
- POST   /api/meal-plans
- PUT    /api/meal-plans/:id
- DELETE /api/meal-plans/:id

### Groceries
- GET    /api/groceries
- POST   /api/groceries/generate
- PUT    /api/groceries/item/:id
- DELETE /api/groceries/item/:id

### Pantry
- GET    /api/pantry
- POST   /api/pantry
- PUT    /api/pantry/:id
- DELETE /api/pantry/:id

### Health
- GET  /api/weight-logs
- POST /api/weight-logs
- GET  /api/nutrition-logs
- POST /api/nutrition-logs

### AI Endpoints
- POST /api/ai/generate-meal-plan
- POST /api/ai/generate-recipe
- POST /api/ai/health-insights
- POST /api/ai/pantry-suggestions

---

## Coding Conventions
- Always use TypeScript with strict types
- Use `async/await` (no raw promises or callbacks)
- All API responses:
```typescript
{ success: true,  data: {...}     }   // success
{ success: false, message: "..." }   // error
```
- Use Prisma for ALL database operations — no raw SQL
- Validate all request inputs using express-validator
- Never expose `password_hash` in API responses
- Always handle errors with try/catch and pass to `next(err)`

---

## AI Service Rules
- All Claude API calls go through the AI service layer
- Each feature has its own prompt builder file
- Prompts must include user context (diet type, allergies, goals)
- AI responses must be parsed and validated before saving to DB
- Always set `max_tokens` appropriately per feature

---

## Security Rules
- JWT stored in httpOnly cookies (not localStorage)
- All protected routes use auth middleware
- Passwords hashed with bcryptjs (salt rounds: 12)
- Rate limit all AI endpoints (expensive calls)
- Sanitise all user inputs before DB operations
- Never log sensitive data (passwords, tokens, API keys)
