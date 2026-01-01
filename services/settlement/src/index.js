// Soko Tabiri - Settlement Service
// Privacy: ONLY service with Zcash key access (via KMS/HSM).
// Default: shielded-only (z-to-z). T-address flows require explicit flags.
// Keys are NEVER stored in env; KMS_KEY_ID references external HSM/KMS.

import 'dotenv/config';
import express from 'express';
import { register, collectDefaultMetrics, Counter, Gauge } from 'prom-client';

import { createDbPool } from './lib/db.js';
import { createRedisClient } from './lib/redis.js';
import { createHmacMiddleware } from './middleware/hmac.js';
import { initLightwalletd } from './lightwalletd/client.js';
import jobsRouter from './routes/jobs.js';
import networkRouter from './routes/network.js';
import addressRouter from './routes/address.js';
import healthRouter from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3003;

// Prometheus metrics
collectDefaultMetrics({ prefix: 'soko_settlement_' });

// Custom metrics
export const pendingJobsGauge = new Gauge({
  name: 'soko_settlement_pending_jobs',
  help: 'Number of pending settlement jobs',
});

export const processedJobsCounter = new Counter({
  name: 'soko_settlement_processed_jobs_total',
  help: 'Total number of processed settlement jobs',
  labelNames: ['job_type', 'status'],
});

export const settlementVolumeCounter = new Counter({
  name: 'soko_settlement_volume_zat_total',
  help: 'Total settlement volume in zatoshi',
  labelNames: ['tx_type'],
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
app.use('/api/jobs', jobsRouter);
app.use('/api/network', networkRouter);
app.use('/api/address', addressRouter);

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
  console.log('\nShutting down Settlement service...');
  if (server) server.close();
  process.exit(0);
});

// Start server
async function start() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║            SOKO TABIRI - SETTLEMENT SERVICE               ║');
  console.log('║              Zcash Lightwalletd Adapter                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Privacy configuration
  const allowDeshield = process.env.ALLOW_DESHIELD === 'true';
  const deshieldKyc = process.env.DESHIELD_KYC === 'true';
  const mockMode = process.env.MOCK_LIGHTWALLETD === 'true';

  console.log('🔒 Privacy Configuration:');
  console.log(`   Default tx type: shielded (z-to-z)`);
  console.log(`   ALLOW_DESHIELD: ${allowDeshield}`);
  console.log(`   DESHIELD_KYC: ${deshieldKyc}`);
  console.log(`   Mock mode: ${mockMode}`);
  console.log('');

  if (!allowDeshield) {
    console.log('   ✅ Transparent/deshield transactions BLOCKED (privacy-first)');
  } else if (!deshieldKyc) {
    console.log('   ⚠️  ALLOW_DESHIELD=true but DESHIELD_KYC=false - deshield still blocked');
  } else {
    console.log('   ⚠️  Transparent/deshield transactions ENABLED (KYC required)');
  }
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

  // Initialize lightwalletd client
  try {
    await initLightwalletd();
    console.log('✅ Lightwalletd initialized');
  } catch (err) {
    console.error('❌ Lightwalletd initialization failed:', err.message);
    if (!mockMode) {
      console.log('   Set MOCK_LIGHTWALLETD=true for local development');
    }
  }

  // Start Express server
  server = app.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Settlement service running at http://localhost:${PORT}`);
    console.log(`📊 Metrics: http://localhost:${PORT}/metrics`);
    console.log(`❤️  Health: http://localhost:${PORT}/health`);
    console.log('');
  });
}

start().catch(console.error);

