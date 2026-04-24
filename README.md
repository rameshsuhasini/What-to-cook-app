# 🍳 What to Cook?

> AI-powered meal planning and nutrition assistant — plan your week, track your health, and discover recipes tailored to you.

[![Live App](https://img.shields.io/badge/Live%20App-Visit-teal?style=for-the-badge)](https://what-to-cook-app.vercel.app/login)
[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?style=for-the-badge)](https://render.com)

---

## ✨ Features

| Module | What it does |
|---|---|
| **Dashboard** | Daily nutrition summary, weight trend chart, today's meals, AI health insights |
| **Recipes** | Browse, search, save recipes — generate new ones with AI |
| **Weekly Planner** | Drag-and-assign meal plan across 7 days × 4 meal types |
| **Grocery List** | Auto-generated from your weekly plan, check off as you shop |
| **Pantry** | Track ingredients with quantity, unit, and expiry dates |
| **Progress** | Log weight and daily nutrition, visualise trends over time |
| **Profile** | Dietary preferences, allergies, calorie and macro goals |
| **Achievements** | Milestone badges and notification system |

### AI Capabilities
- 🤖 **AI Recipe Generator** — describe what you want, get a full recipe
- 📅 **AI Meal Plan Generator** — weekly plan tailored to your goals and preferences
- 💡 **AI Health Insights** — personalised daily health and nutrition recommendations
- 🧺 **AI Pantry Suggestions** — recipe ideas based on what you already have

---

## 🛠 Tech Stack

### Frontend
- **Next.js 16** (App Router) + **React** + **TypeScript**
- **Framer Motion** — animations and micro-interactions
- **React Query** — server state management
- **Zustand** — client state
- **Recharts** — data visualisations
- **Tailwind CSS** + custom design tokens

### Backend
- **Node.js** (v20.19.5) + **Express** + **TypeScript**
- **Prisma ORM** — type-safe database access
- **PostgreSQL** via **Neon** (serverless)
- **JWT** authentication (httpOnly cookies)

### AI
- **Anthropic Claude API** (`claude-sonnet-4-20250514`)
- Dedicated AI service layer with per-feature prompt builders

---

## 🚀 Local Setup

### Prerequisites
- Node.js **v20.19.5**
- A [Neon](https://neon.tech) database (free tier works)
- An [Anthropic](https://console.anthropic.com) API key

### 1. Clone the repo
```bash
git clone https://github.com/your-username/what-to-cook-app.git
cd what-to-cook-app
```

### 2. Backend
```bash
cd backend
npm install
```

Create `backend/.env`:
```env
DATABASE_URL=        # Neon PostgreSQL pooled connection string
ANTHROPIC_API_KEY=   # Anthropic Claude API key
JWT_SECRET=          # Strong random string (min 32 chars)
PORT=5000
NODE_ENV=development
```

```bash
npm run prisma:generate   # generate Prisma client
npm run prisma:migrate    # run migrations
npm run dev               # http://localhost:5000
```

### 3. Frontend
```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

```bash
npm run dev               # http://localhost:3000
```

### 4. Open the app
Go to **http://localhost:3000**, sign up, and complete onboarding.

---

## 🗄 Database

Powered by **Neon** (serverless PostgreSQL) with **Prisma ORM**.

```bash
npm run prisma:migrate    # apply migrations
npm run prisma:push       # sync schema without migration (dev only)
npm run prisma:studio     # open Prisma Studio GUI at localhost:5555
npm run prisma:generate   # regenerate client after schema changes
```

**Entities:** `users` · `user_profiles` · `recipes` · `recipe_ingredients` · `recipe_steps` · `saved_recipes` · `meal_plans` · `meal_plan_items` · `grocery_lists` · `grocery_items` · `pantry_items` · `weight_logs` · `nutrition_logs`

---

## 📁 Project Structure

```
what-to-cook/
├── backend/
│   ├── src/
│   │   ├── controllers/     # HTTP request/response only
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # DB access via Prisma
│   │   ├── routes/          # Express route definitions
│   │   ├── middleware/       # Auth, validation, rate limiting
│   │   └── ai/              # Claude prompt builders per feature
│   └── prisma/
│       └── schema.prisma
└── frontend/
    ├── app/                 # Next.js App Router pages
    ├── components/          # Shared UI components
    ├── services/            # API service layer
    ├── store/               # Zustand stores
    ├── hooks/               # Custom React hooks
    └── types/               # TypeScript types
```

---

## 🔒 Security

- Passwords hashed with **bcryptjs** (12 salt rounds)
- JWTs stored in **httpOnly cookies** only — never `localStorage`
- All endpoints validated and sanitised with **express-validator**
- AI endpoints rate-limited to prevent abuse
- **Helmet** + **CORS** configured on the backend

---

## 🗺 Roadmap

- [ ] Recipe serving size scaler
- [ ] Progress page UI revamp
- [ ] Redis caching for AI responses
- [ ] Email verification on signup
- [ ] Mobile app (React Native)

---

## 📄 License

MIT
