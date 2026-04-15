import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.routes';
import recipeRoutes from './routes/recipe.routes';
import mealPlanRoutes from './routes/meal-plan.routes'
import groceryRoutes from './routes/grocery.routes'
import pantryRoutes from './routes/pantry.routes'
import healthRoutes from './routes/health.routes'
import aiRoutes from './routes/ai.routes'
import profileRoutes from './routes/profile.routes'

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_URL,
].filter(Boolean) as string[]

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl)
    if (!origin) return callback(null, true)
    if (allowedOrigins.some((o) => origin === o || origin.endsWith('.vercel.app'))) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Generous timeout for AI endpoints (meal plan generation, etc.)
// Render's default proxy timeout is 30s; we set 90s here so Express
// can return a proper error if Claude is slow rather than a hard cut.
app.use((req, res, next) => {
  res.setTimeout(90_000, () => {
    res.status(503).json({ success: false, message: 'Request timed out — please try again.' })
  })
  next()
})
app.use('/api/recipes', recipeRoutes)
app.use('/api/meal-plans', mealPlanRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/groceries', groceryRoutes)
app.use('/api/pantry', pantryRoutes)
app.use('/api/profile', profileRoutes)
app.use('/api', healthRoutes)

// ─── Health Check ─────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'What to Cook API is running 🍽️' });
});

app.use('/api/auth', authRoutes)

// ─── 404 Handler ──────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// ─── Start Server ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

export default app;