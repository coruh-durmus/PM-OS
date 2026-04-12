import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { oauthRoutes } from './routes/oauth.js';
import { apiRoutes } from './routes/api.js';

const app = new Hono();

// ----- Middleware -----

// CORS
app.use('*', cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

app.use('*', async (c, next) => {
  const ip = c.req.header('x-forwarded-for') ?? 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }
  }

  await next();
});

// ----- Routes -----
app.route('/oauth', oauthRoutes);
app.route('/', apiRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export { app };
