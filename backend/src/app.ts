import express, { Application, Request, Response, NextFunction } from 'express';
import path from 'path';
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
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Serve uploaded files with cross-origin policy so the frontend (port 3000)
// can load images served from the backend (port 5000)
app.use('/uploads', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  next()
}, express.static(path.join(process.cwd(), 'uploads')));
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