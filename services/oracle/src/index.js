// Soko Tabiri - Oracle Service
// Privacy: Manages attestations and disputes. No direct Zcash key access.
// Stake slashing is routed through the settlement service.

import 'dotenv/config';
import express from 'express';
import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client';

import { createDbPool } from './lib/db.js';
import { createRedisClient } from './lib/redis.js';
import { createHmacMiddleware } from './middleware/hmac.js';
import reportersRouter from './routes/reporters.js';
import attestationsRouter from './routes/attestations.js';
import disputesRouter from './routes/disputes.js';
import healthRouter from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3004;

// Prometheus metrics
collectDefaultMetrics({ prefix: 'soko_oracle_' });

// Custom metrics
export const attestationCounter = new Counter({
  name: 'soko_oracle_attestations_total',
  help: 'Total number of attestations submitted',
  labelNames: ['outcome', 'status'],
});

export const disputeCounter = new Counter({
  name: 'soko_oracle_disputes_total',
  help: 'Total number of disputes opened',
  labelNames: ['status'],
});

export const activeReportersGauge = new Gauge({
  name: 'soko_oracle_active_reporters',
  help: 'Number of active reporters',
});

export const oracleDisagreementGauge = new Gauge({
  name: 'soko_oracle_disagreement_rate',
  help: 'Rate of disagreement between reporters (0-1)',
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
app.use('/api/reporters', reportersRouter);
app.use('/api/attestations', attestationsRouter);
app.use('/api/disputes', disputesRouter);

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
  console.log('\nShutting down Oracle service...');
  if (server) server.close();
  process.exit(0);
});

// Start server
async function start() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              SOKO TABIRI - ORACLE SERVICE                 ║');
  console.log('║            Reporter & Dispute Management                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Configuration
  const disputeWindowHours = parseInt(process.env.DISPUTE_WINDOW_HOURS || '24');
  const minStakeZat = parseInt(process.env.MIN_STAKE_ZAT || '100000000');

  console.log('⚙️  Configuration:');
  console.log(`   Dispute window: ${disputeWindowHours} hours`);
  console.log(`   Minimum stake: ${minStakeZat / 100000000} ZEC`);
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
    console.log(`🚀 Oracle service running at http://localhost:${PORT}`);
    console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log('');
  });
}

start().catch(console.error);

