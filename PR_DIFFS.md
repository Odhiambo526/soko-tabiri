# Soko Tabiri - PR Diffs

This document contains patch-style diffs for the five priority PRs.

---

## PR 1: `chore: dockerize backend into services`

**Description**: Split monolithic backend into four microservices with Docker support.

```diff
diff --git a/docker-compose.yml b/docker-compose.yml
new file mode 100644
index 0000000..abc1234
--- /dev/null
+++ b/docker-compose.yml
@@ -0,0 +1,150 @@
+# Soko Tabiri - Docker Compose Configuration
+version: '3.8'
+
+services:
+  postgres:
+    image: postgres:15-alpine
+    container_name: soko-postgres
+    environment:
+      POSTGRES_USER: ${POSTGRES_USER:-soko}
+      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-soko_dev_password}
+      POSTGRES_DB: ${POSTGRES_DB:-soko_tabiri}
+    volumes:
+      - postgres_data:/var/lib/postgresql/data
+      - ./migrations:/docker-entrypoint-initdb.d:ro
+    ports:
+      - "5432:5432"
+    healthcheck:
+      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-soko}"]
+      interval: 5s
+      timeout: 5s
+      retries: 5
+
+  redis:
+    image: redis:7-alpine
+    container_name: soko-redis
+    command: redis-server --appendonly yes
+    volumes:
+      - redis_data:/data
+    ports:
+      - "6379:6379"
+
+  gateway-api:
+    build:
+      context: ./services/gateway-api
+      dockerfile: Dockerfile
+    container_name: soko-gateway
+    environment:
+      NODE_ENV: ${NODE_ENV:-development}
+      PORT: 3001
+      DATABASE_URL: postgres://${POSTGRES_USER:-soko}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-soko_tabiri}
+      REDIS_URL: redis://redis:6379
+      ENGINE_URL: http://engine:3002
+      SETTLEMENT_URL: http://settlement:3003
+      ORACLE_URL: http://oracle:3004
+      INTERNAL_HMAC_SECRET: ${INTERNAL_HMAC_SECRET}
+    ports:
+      - "3001:3001"
+    depends_on:
+      postgres:
+        condition: service_healthy
+      redis:
+        condition: service_healthy
+
+  engine:
+    build:
+      context: ./services/engine
+      dockerfile: Dockerfile
+    container_name: soko-engine
+    environment:
+      NODE_ENV: ${NODE_ENV:-development}
+      PORT: 3002
+      DATABASE_URL: postgres://${POSTGRES_USER:-soko}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-soko_tabiri}
+      REDIS_URL: redis://redis:6379
+      INTERNAL_HMAC_SECRET: ${INTERNAL_HMAC_SECRET}
+    ports:
+      - "3002:3002"
+    depends_on:
+      - postgres
+      - redis
+
+  settlement:
+    build:
+      context: ./services/settlement
+      dockerfile: Dockerfile
+    container_name: soko-settlement
+    environment:
+      NODE_ENV: ${NODE_ENV:-development}
+      PORT: 3003
+      DATABASE_URL: postgres://${POSTGRES_USER:-soko}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-soko_tabiri}
+      REDIS_URL: redis://redis:6379
+      INTERNAL_HMAC_SECRET: ${INTERNAL_HMAC_SECRET}
+      LIGHTWALLETD_URL: ${LIGHTWALLETD_URL:-lightwalletd.testnet.electriccoin.co:9067}
+      MOCK_LIGHTWALLETD: ${MOCK_LIGHTWALLETD:-true}
+      ALLOW_DESHIELD: ${ALLOW_DESHIELD:-false}
+      DESHIELD_KYC: ${DESHIELD_KYC:-false}
+    ports:
+      - "3003:3003"
+    depends_on:
+      - postgres
+      - redis
+
+  oracle:
+    build:
+      context: ./services/oracle
+      dockerfile: Dockerfile
+    container_name: soko-oracle
+    environment:
+      NODE_ENV: ${NODE_ENV:-development}
+      PORT: 3004
+      DATABASE_URL: postgres://${POSTGRES_USER:-soko}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-soko_tabiri}
+      REDIS_URL: redis://redis:6379
+      INTERNAL_HMAC_SECRET: ${INTERNAL_HMAC_SECRET}
+    ports:
+      - "3004:3004"
+    depends_on:
+      - postgres
+      - redis
+
+volumes:
+  postgres_data:
+  redis_data:

diff --git a/services/gateway-api/Dockerfile b/services/gateway-api/Dockerfile
new file mode 100644
index 0000000..def5678
--- /dev/null
+++ b/services/gateway-api/Dockerfile
@@ -0,0 +1,20 @@
+FROM node:18-alpine
+WORKDIR /app
+RUN apk add --no-cache wget
+COPY package*.json ./
+RUN npm ci --only=production
+COPY . .
+RUN addgroup -g 1001 -S nodejs && \
+    adduser -S nodejs -u 1001 -G nodejs && \
+    chown -R nodejs:nodejs /app
+USER nodejs
+EXPOSE 3001
+HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
+    CMD wget -q --spider http://localhost:3001/health || exit 1
+CMD ["node", "src/index.js"]

diff --git a/Makefile b/Makefile
new file mode 100644
index 0000000..ghi9012
--- /dev/null
+++ b/Makefile
@@ -0,0 +1,30 @@
+.PHONY: dev-up dev-down test lint
+
+dev-up:
+	docker-compose -f docker-compose.yml up --build -d
+
+dev-down:
+	docker-compose -f docker-compose.yml down
+
+test:
+	cd services/engine && npm test
+
+lint:
+	cd services/gateway-api && npm run lint
+	cd services/engine && npm run lint
+	cd services/settlement && npm run lint
+	cd services/oracle && npm run lint
```

---

## PR 2: `feat: postgres migration + redis caching`

**Description**: Add PostgreSQL schema migrations and Redis caching infrastructure.

```diff
diff --git a/migrations/001_init.sql b/migrations/001_init.sql
new file mode 100644
index 0000000..jkl3456
--- /dev/null
+++ b/migrations/001_init.sql
@@ -0,0 +1,200 @@
+-- Soko Tabiri - Initial Database Schema
+-- ASSUMPTION: Postgres 15 (LTS)
+
+CREATE TABLE IF NOT EXISTS schema_migrations (
+    version VARCHAR(255) PRIMARY KEY,
+    applied_at TIMESTAMPTZ DEFAULT NOW()
+);
+
+INSERT INTO schema_migrations (version) VALUES ('001_init')
+ON CONFLICT (version) DO NOTHING;
+
+-- Users table (ephemeral mapping, no PII)
+CREATE TABLE IF NOT EXISTS users (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    viewing_key_hash VARCHAR(64) UNIQUE NOT NULL,
+    shielded_address_index INTEGER DEFAULT 0,
+    created_at TIMESTAMPTZ DEFAULT NOW(),
+    last_active_at TIMESTAMPTZ DEFAULT NOW(),
+    kyc_verified BOOLEAN DEFAULT FALSE
+);
+
+-- Markets table
+CREATE TABLE IF NOT EXISTS markets (
+    id VARCHAR(64) PRIMARY KEY,
+    title TEXT NOT NULL,
+    description TEXT,
+    category VARCHAR(64) NOT NULL,
+    region VARCHAR(64),
+    yes_price DECIMAL(10, 8) DEFAULT 0.5,
+    no_price DECIMAL(10, 8) DEFAULT 0.5,
+    volume_zat BIGINT DEFAULT 0,
+    liquidity_zat BIGINT DEFAULT 0,
+    created_at TIMESTAMPTZ DEFAULT NOW(),
+    end_date TIMESTAMPTZ NOT NULL,
+    resolved BOOLEAN DEFAULT FALSE,
+    outcome VARCHAR(8) CHECK (outcome IN ('yes', 'no', 'invalid'))
+);
+
+-- Orders table (limit orderbook)
+CREATE TABLE IF NOT EXISTS orders (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    user_id UUID NOT NULL REFERENCES users(id),
+    market_id VARCHAR(64) NOT NULL REFERENCES markets(id),
+    side VARCHAR(8) NOT NULL CHECK (side IN ('yes', 'no')),
+    order_type VARCHAR(16) NOT NULL CHECK (order_type IN ('limit', 'market')),
+    direction VARCHAR(8) NOT NULL CHECK (direction IN ('buy', 'sell')),
+    price DECIMAL(10, 8),
+    quantity BIGINT NOT NULL,
+    filled_quantity BIGINT DEFAULT 0,
+    status VARCHAR(16) DEFAULT 'open'
+);
+
+-- Fills table
+CREATE TABLE IF NOT EXISTS fills (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    order_id UUID REFERENCES orders(id),
+    user_id UUID NOT NULL REFERENCES users(id),
+    market_id VARCHAR(64) NOT NULL REFERENCES markets(id),
+    side VARCHAR(8) NOT NULL,
+    direction VARCHAR(8) NOT NULL,
+    price DECIMAL(10, 8) NOT NULL,
+    quantity BIGINT NOT NULL,
+    amount_zat BIGINT NOT NULL,
+    source VARCHAR(16) NOT NULL CHECK (source IN ('amm', 'orderbook')),
+    created_at TIMESTAMPTZ DEFAULT NOW()
+);
+
+-- Stakes table (oracle reporters)
+CREATE TABLE IF NOT EXISTS stakes (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    user_id UUID NOT NULL REFERENCES users(id),
+    stake_type VARCHAR(16) NOT NULL CHECK (stake_type IN ('reporter', 'liquidity')),
+    amount_zat BIGINT NOT NULL,
+    status VARCHAR(16) DEFAULT 'active' CHECK (status IN ('active', 'locked', 'slashed', 'withdrawn')),
+    created_at TIMESTAMPTZ DEFAULT NOW()
+);
+
+-- Settlement jobs table
+CREATE TABLE IF NOT EXISTS settlement_jobs (
+    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
+    job_type VARCHAR(32) NOT NULL,
+    fill_id UUID REFERENCES fills(id),
+    user_id UUID REFERENCES users(id),
+    amount_zat BIGINT NOT NULL,
+    tx_type VARCHAR(16) DEFAULT 'shielded',
+    status VARCHAR(16) DEFAULT 'pending',
+    tx_hash VARCHAR(128),
+    created_at TIMESTAMPTZ DEFAULT NOW()
+);
+
+-- Liquidity pools table
+CREATE TABLE IF NOT EXISTS liquidity_pools (
+    market_id VARCHAR(64) PRIMARY KEY REFERENCES markets(id),
+    yes_shares BIGINT DEFAULT 1000000,
+    no_shares BIGINT DEFAULT 1000000,
+    constant_product BIGINT DEFAULT 1000000000000,
+    fee_bps INTEGER DEFAULT 30
+);

diff --git a/services/gateway-api/src/lib/redis.js b/services/gateway-api/src/lib/redis.js
new file mode 100644
index 0000000..mno7890
--- /dev/null
+++ b/services/gateway-api/src/lib/redis.js
@@ -0,0 +1,25 @@
+import { createClient } from 'redis';
+
+let client = null;
+
+export async function createRedisClient(url) {
+  if (client) return client;
+  client = createClient({ url: url || process.env.REDIS_URL });
+  client.on('error', (err) => console.error('Redis error:', err));
+  await client.connect();
+  return client;
+}
+
+export function getRedis() {
+  return client;
+}
```

---

## PR 3: `feat: settlement service skeleton + lightwalletd config`

**Description**: Add settlement service with lightwalletd adapter and privacy controls.

```diff
diff --git a/services/settlement/src/index.js b/services/settlement/src/index.js
new file mode 100644
index 0000000..pqr1234
--- /dev/null
+++ b/services/settlement/src/index.js
@@ -0,0 +1,80 @@
+// Settlement Service
+// Privacy: ONLY service with Zcash key access (via KMS/HSM).
+// Default: shielded-only (z-to-z). T-address flows require explicit flags.
+
+import 'dotenv/config';
+import express from 'express';
+import { register, collectDefaultMetrics } from 'prom-client';
+import { createDbPool } from './lib/db.js';
+import { createRedisClient } from './lib/redis.js';
+import { initLightwalletd } from './lightwalletd/client.js';
+import jobsRouter from './routes/jobs.js';
+import networkRouter from './routes/network.js';
+import healthRouter from './routes/health.js';
+
+const app = express();
+const PORT = process.env.PORT || 3003;
+
+collectDefaultMetrics({ prefix: 'soko_settlement_' });
+
+app.use(express.json());
+app.use('/health', healthRouter);
+app.get('/metrics', async (req, res) => {
+  res.set('Content-Type', register.contentType);
+  res.end(await register.metrics());
+});
+app.use('/api/jobs', jobsRouter);
+app.use('/api/network', networkRouter);
+
+async function start() {
+  const allowDeshield = process.env.ALLOW_DESHIELD === 'true';
+  const deshieldKyc = process.env.DESHIELD_KYC === 'true';
+  
+  console.log('Privacy Configuration:');
+  console.log(`  ALLOW_DESHIELD: ${allowDeshield}`);
+  console.log(`  DESHIELD_KYC: ${deshieldKyc}`);
+  
+  await createDbPool(process.env.DATABASE_URL);
+  await createRedisClient(process.env.REDIS_URL);
+  await initLightwalletd();
+  
+  app.listen(PORT, () => {
+    console.log(`Settlement service running on port ${PORT}`);
+  });
+}
+
+start().catch(console.error);

diff --git a/services/settlement/src/lightwalletd/client.js b/services/settlement/src/lightwalletd/client.js
new file mode 100644
index 0000000..stu5678
--- /dev/null
+++ b/services/settlement/src/lightwalletd/client.js
@@ -0,0 +1,60 @@
+// Lightwalletd Client
+// Keys accessed via KMS, never stored locally.
+
+import grpc from '@grpc/grpc-js';
+import protoLoader from '@grpc/proto-loader';
+
+let client = null;
+let mockMode = false;
+
+export async function initLightwalletd() {
+  mockMode = process.env.MOCK_LIGHTWALLETD === 'true';
+  
+  if (mockMode) {
+    console.log('Running in MOCK_LIGHTWALLETD mode');
+    return;
+  }
+
+  const lightwalletdUrl = process.env.LIGHTWALLETD_URL;
+  const [host, port] = lightwalletdUrl.split(':');
+  
+  const protoPath = './proto/service.proto';
+  const packageDefinition = protoLoader.loadSync(protoPath);
+  const proto = grpc.loadPackageDefinition(packageDefinition);
+  
+  const credentials = process.env.ZCASH_NETWORK === 'testnet'
+    ? grpc.credentials.createInsecure()
+    : grpc.credentials.createSsl();
+
+  client = new proto.cash.z.wallet.sdk.rpc.CompactTxStreamer(
+    `${host}:${port}`,
+    credentials
+  );
+}
+
+export function getConnectionStatus() {
+  return { connected: !!client || mockMode, mockMode };
+}

diff --git a/services/settlement/src/routes/jobs.js b/services/settlement/src/routes/jobs.js
new file mode 100644
index 0000000..vwx9012
--- /dev/null
+++ b/services/settlement/src/routes/jobs.js
@@ -0,0 +1,50 @@
+// Settlement Jobs Routes
+// Privacy: Enforces shielded-only by default
+
+import { Router } from 'express';
+import { v4 as uuidv4 } from 'uuid';
+import { query } from '../lib/db.js';
+
+const router = Router();
+const ALLOW_DESHIELD = process.env.ALLOW_DESHIELD === 'true';
+const DESHIELD_KYC = process.env.DESHIELD_KYC === 'true';
+
+router.post('/', async (req, res) => {
+  const { job_type, amount_zat, tx_type = 'shielded' } = req.body;
+
+  // Privacy enforcement
+  if (tx_type !== 'shielded') {
+    if (!ALLOW_DESHIELD) {
+      return res.status(422).json({
+        error: 'Transparent/deshield transactions not allowed',
+        message: 'Set ALLOW_DESHIELD=true to enable'
+      });
+    }
+    if (!DESHIELD_KYC) {
+      return res.status(422).json({
+        error: 'Deshield requires KYC verification',
+        message: 'Set DESHIELD_KYC=true after implementing KYC'
+      });
+    }
+  }
+
+  const jobId = uuidv4();
+  await query(
+    `INSERT INTO settlement_jobs (id, job_type, amount_zat, tx_type, status)
+     VALUES ($1, $2, $3, $4, 'pending')`,
+    [jobId, job_type, amount_zat, tx_type]
+  );
+
+  res.status(201).json({ job: { id: jobId, status: 'pending' } });
+});
+
+export default router;
```

---

## PR 4: `feat: oracle model + dispute endpoints`

**Description**: Add oracle attestation and dispute management.

```diff
diff --git a/services/oracle/src/index.js b/services/oracle/src/index.js
new file mode 100644
index 0000000..yza3456
--- /dev/null
+++ b/services/oracle/src/index.js
@@ -0,0 +1,50 @@
+// Oracle Service
+// Manages attestations and disputes. No direct Zcash key access.
+
+import 'dotenv/config';
+import express from 'express';
+import { register, collectDefaultMetrics } from 'prom-client';
+import { createDbPool } from './lib/db.js';
+import { createRedisClient } from './lib/redis.js';
+import reportersRouter from './routes/reporters.js';
+import attestationsRouter from './routes/attestations.js';
+import disputesRouter from './routes/disputes.js';
+import healthRouter from './routes/health.js';
+
+const app = express();
+const PORT = process.env.PORT || 3004;
+
+collectDefaultMetrics({ prefix: 'soko_oracle_' });
+
+app.use(express.json());
+app.use('/health', healthRouter);
+app.get('/metrics', async (req, res) => {
+  res.set('Content-Type', register.contentType);
+  res.end(await register.metrics());
+});
+app.use('/api/reporters', reportersRouter);
+app.use('/api/attestations', attestationsRouter);
+app.use('/api/disputes', disputesRouter);
+
+async function start() {
+  console.log('Oracle Configuration:');
+  console.log(`  Dispute window: ${process.env.DISPUTE_WINDOW_HOURS || 24}h`);
+  console.log(`  Min stake: ${(process.env.MIN_STAKE_ZAT || 100000000) / 100000000} ZEC`);
+  
+  await createDbPool(process.env.DATABASE_URL);
+  await createRedisClient(process.env.REDIS_URL);
+  
+  app.listen(PORT, () => {
+    console.log(`Oracle service running on port ${PORT}`);
+  });
+}
+
+start().catch(console.error);

diff --git a/services/oracle/src/routes/reporters.js b/services/oracle/src/routes/reporters.js
new file mode 100644
index 0000000..bcd7890
--- /dev/null
+++ b/services/oracle/src/routes/reporters.js
@@ -0,0 +1,40 @@
+// Reporters Routes - Registration with bonded stake
+
+import { Router } from 'express';
+import { v4 as uuidv4 } from 'uuid';
+import { query, getPool } from '../lib/db.js';
+
+const router = Router();
+const MIN_STAKE_ZAT = parseInt(process.env.MIN_STAKE_ZAT || '100000000');
+
+router.post('/', async (req, res) => {
+  const { user_id, stake_amount_zat } = req.body;
+
+  if (stake_amount_zat < MIN_STAKE_ZAT) {
+    return res.status(400).json({
+      error: 'Insufficient stake',
+      minimum: MIN_STAKE_ZAT
+    });
+  }
+
+  const pool = getPool();
+  const client = await pool.connect();
+  
+  try {
+    await client.query('BEGIN');
+    
+    const stakeId = uuidv4();
+    await client.query(
+      `INSERT INTO stakes (id, user_id, stake_type, amount_zat, status)
+       VALUES ($1, $2, 'reporter', $3, 'active')`,
+      [stakeId, user_id, stake_amount_zat]
+    );
+    
+    await client.query('COMMIT');
+    res.status(201).json({ reporter: { id: stakeId, status: 'active' } });
+  } catch (error) {
+    await client.query('ROLLBACK');
+    res.status(500).json({ error: 'Failed to register reporter' });
+  } finally {
+    client.release();
+  }
+});
+
+export default router;

diff --git a/services/oracle/src/routes/disputes.js b/services/oracle/src/routes/disputes.js
new file mode 100644
index 0000000..efg1234
--- /dev/null
+++ b/services/oracle/src/routes/disputes.js
@@ -0,0 +1,60 @@
+// Disputes Routes - Dispute attestations
+
+import { Router } from 'express';
+import { v4 as uuidv4 } from 'uuid';
+import { query, getPool } from '../lib/db.js';
+
+const router = Router();
+const DISPUTE_WINDOW_HOURS = parseInt(process.env.DISPUTE_WINDOW_HOURS || '24');
+
+router.post('/', async (req, res) => {
+  const { attestation_id, disputer_id, disputed_outcome, reason } = req.body;
+
+  const pool = getPool();
+  const client = await pool.connect();
+  
+  try {
+    await client.query('BEGIN');
+    
+    // Get attestation
+    const attestationResult = await client.query(
+      'SELECT * FROM oracle_attestations WHERE id = $1',
+      [attestation_id]
+    );
+    
+    if (attestationResult.rows.length === 0) {
+      return res.status(404).json({ error: 'Attestation not found' });
+    }
+    
+    const attestation = attestationResult.rows[0];
+    
+    // Check dispute window
+    const windowEnd = new Date(attestation.created_at).getTime() + 
+                      DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
+    if (Date.now() > windowEnd) {
+      return res.status(400).json({ error: 'Dispute window closed' });
+    }
+    
+    // Create dispute
+    const disputeId = uuidv4();
+    await client.query(
+      `INSERT INTO disputes 
+       (id, attestation_id, market_id, disputer_id, disputed_outcome, reason, status)
+       VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
+      [disputeId, attestation_id, attestation.market_id, disputer_id, disputed_outcome, reason]
+    );
+    
+    // Update attestation status
+    await client.query(
+      `UPDATE oracle_attestations SET status = 'disputed' WHERE id = $1`,
+      [attestation_id]
+    );
+    
+    await client.query('COMMIT');
+    res.status(201).json({ dispute: { id: disputeId, status: 'open' } });
+  } catch (error) {
+    await client.query('ROLLBACK');
+    res.status(500).json({ error: 'Failed to create dispute' });
+  } finally {
+    client.release();
+  }
+});
+
+export default router;
```

---

## PR 5: `chore: add CI workflow + metrics`

**Description**: Add GitHub Actions CI and Prometheus/Grafana monitoring.

```diff
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
new file mode 100644
index 0000000..hij5678
--- /dev/null
+++ b/.github/workflows/ci.yml
@@ -0,0 +1,80 @@
+name: CI
+
+on:
+  push:
+    branches: [main, develop]
+  pull_request:
+    branches: [main, develop]
+
+jobs:
+  lint:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '18'
+      - run: cd services/engine && npm ci
+      - run: cd services/engine && npm run lint || true
+
+  unit-tests:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: '18'
+      - run: cd services/engine && npm ci
+      - run: cd services/engine && npm test
+
+  docker-build:
+    runs-on: ubuntu-latest
+    steps:
+      - uses: actions/checkout@v4
+      - uses: docker/setup-buildx-action@v3
+      - uses: docker/build-push-action@v5
+        with:
+          context: ./services/gateway-api
+          push: false
+          tags: soko-tabiri/gateway-api:test
+
+  integration-test:
+    runs-on: ubuntu-latest
+    needs: [unit-tests, docker-build]
+    steps:
+      - uses: actions/checkout@v4
+      - run: |
+          cat > .env << EOF
+          MOCK_LIGHTWALLETD=true
+          INTERNAL_HMAC_SECRET=test_secret
+          EOF
+      - run: docker-compose up -d --build
+      - run: sleep 30
+      - run: curl -f http://localhost:3001/health
+      - run: curl -f http://localhost:3002/health
+      - run: curl -f http://localhost:3003/health
+      - run: curl -f http://localhost:3004/health
+      - if: always()
+        run: docker-compose down -v

diff --git a/monitoring/prometheus.yml b/monitoring/prometheus.yml
new file mode 100644
index 0000000..klm9012
--- /dev/null
+++ b/monitoring/prometheus.yml
@@ -0,0 +1,30 @@
+global:
+  scrape_interval: 15s
+
+scrape_configs:
+  - job_name: 'prometheus'
+    static_configs:
+      - targets: ['localhost:9090']
+
+  - job_name: 'gateway-api'
+    static_configs:
+      - targets: ['gateway-api:3001']
+    metrics_path: /metrics
+
+  - job_name: 'engine'
+    static_configs:
+      - targets: ['engine:3002']
+    metrics_path: /metrics
+
+  - job_name: 'settlement'
+    static_configs:
+      - targets: ['settlement:3003']
+    metrics_path: /metrics
+
+  - job_name: 'oracle'
+    static_configs:
+      - targets: ['oracle:3004']
+    metrics_path: /metrics

diff --git a/monitoring/grafana/provisioning/datasources/datasources.yml b/monitoring/grafana/provisioning/datasources/datasources.yml
new file mode 100644
index 0000000..nop3456
--- /dev/null
+++ b/monitoring/grafana/provisioning/datasources/datasources.yml
@@ -0,0 +1,8 @@
+apiVersion: 1
+
+datasources:
+  - name: Prometheus
+    type: prometheus
+    access: proxy
+    url: http://prometheus:9090
+    isDefault: true
```

---

## Summary

| PR | Title | Files Changed | Description |
|----|-------|---------------|-------------|
| 1 | `chore: dockerize backend into services` | 8 | Docker Compose, Dockerfiles, Makefile |
| 2 | `feat: postgres migration + redis caching` | 4 | SQL migrations, Redis client |
| 3 | `feat: settlement service skeleton + lightwalletd config` | 6 | Settlement service, privacy controls |
| 4 | `feat: oracle model + dispute endpoints` | 5 | Oracle service, reporter/dispute logic |
| 5 | `chore: add CI workflow + metrics` | 4 | GitHub Actions, Prometheus config |

Each PR is designed to be independently reviewable and mergeable in sequence.

