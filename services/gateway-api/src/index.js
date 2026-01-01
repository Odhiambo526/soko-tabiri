// Soko Tabiri - Gateway API Service
// Privacy: This service handles user-facing requests. No direct Zcash key access.
// All settlement requests are routed to the settlement service via HMAC-authenticated internal calls.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { register, collectDefaultMetrics } from 'prom-client';

import { createDbPool } from './lib/db.js';
import { createRedisClient } from './lib/redis.js';
import marketsRouter from './routes/markets.js';
import walletsRouter from './routes/wallets.js';
import healthRouter from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Prometheus metrics
collectDefaultMetrics({ prefix: 'soko_gateway_' });

// Middleware
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(',');
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${new Date().toISOString()} ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// Health check (no auth required)
app.use('/health', healthRouter);

// Prometheus metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// API Routes
app.use('/api/markets', marketsRouter);
app.use('/api/wallet', walletsRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
let server;
process.on('SIGINT', async () => {
  console.log('\nShutting down Gateway API...');
  if (server) server.close();
  process.exit(0);
});

// Start server
async function start() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              SOKO TABIRI - GATEWAY API                    ║');
  console.log('║         Privacy-Preserving Prediction Markets             ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize database
  try {
    await createDbPool(process.env.DATABASE_URL);
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    // Continue without DB for health checks
  }

  // Initialize Redis
  try {
    await createRedisClient(process.env.REDIS_URL);
    console.log('✅ Redis connected');
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
    // Continue without Redis for health checks
  }

  // Start Express server
  server = app.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Gateway API running at http://localhost:${PORT}`);
    console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log('');
  });
}

start().catch(console.error);

