// Soko Tabiri - Engine Service (AMM + Orderbook)
// Privacy: Performs AMM math and orderbook matching. No access to Zcash keys.
// Outputs settlement_jobs for the settlement service.

import 'dotenv/config';
import express from 'express';
import { register, collectDefaultMetrics, Counter, Histogram } from 'prom-client';

import { createDbPool } from './lib/db.js';
import { createRedisClient } from './lib/redis.js';
import { createHmacMiddleware } from './middleware/hmac.js';
import quoteRouter from './routes/quote.js';
import tradeRouter from './routes/trade.js';
import healthRouter from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Prometheus metrics
collectDefaultMetrics({ prefix: 'soko_engine_' });

// Custom metrics
export const tradeCounter = new Counter({
  name: 'soko_engine_trades_total',
  help: 'Total number of trades executed',
  labelNames: ['market', 'side', 'source'],
});

export const tradeVolumeHistogram = new Histogram({
  name: 'soko_engine_trade_volume_zat',
  help: 'Trade volume in zatoshi',
  labelNames: ['market'],
  buckets: [1000000, 10000000, 100000000, 1000000000, 10000000000],
});

// Middleware
app.use(express.json());

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

// HMAC authentication for internal service calls
const hmacSecret = process.env.INTERNAL_HMAC_SECRET;
if (hmacSecret && hmacSecret !== 'dev_hmac_secret_change_in_production') {
  app.use('/api', createHmacMiddleware(hmacSecret));
}

// API Routes
app.use('/api/quote', quoteRouter);
app.use('/api/trade', tradeRouter);

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
  console.log('\nShutting down Engine service...');
  if (server) server.close();
  process.exit(0);
});

// Start server
async function start() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              SOKO TABIRI - ENGINE SERVICE                 ║');
  console.log('║                  AMM + Orderbook                          ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize database
  try {
    await createDbPool(process.env.DATABASE_URL);
    console.log('✅ Database connected');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }

  // Initialize Redis
  try {
    await createRedisClient(process.env.REDIS_URL);
    console.log('✅ Redis connected');
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
  }

  // Start Express server
  server = app.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Engine service running at http://localhost:${PORT}`);
    console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log('');
  });
}

start().catch(console.error);

