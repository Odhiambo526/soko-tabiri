# Soko Tabiri: Technical Architecture and Development Pipeline Documentation

**Version:** 1.0  
**Date:** January 1, 2026  
**Repository:** https://github.com/Odhiambo526/soko-tabiri

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Architecture](#architecture)
4. [Service Details](#service-details)
5. [Database Schema](#database-schema)
6. [Privacy and Security](#privacy-and-security)
7. [Development Pipeline](#development-pipeline)
8. [Deployment](#deployment)
9. [Monitoring and Operations](#monitoring-and-operations)
10. [Assumptions and Limitations](#assumptions-and-limitations)

---

## Executive Summary

**Soko Tabiri** (Swahili: "Market Prediction") is a privacy-preserving prediction market platform built on Zcash. Unlike public prediction markets like Polymarket, Soko Tabiri uses Zcash's shielded transactions to protect user privacy, making it suitable for sensitive markets in emerging economies.

### Key Differentiators

- **Privacy-First**: All transactions use Zcash shielded addresses (z-to-z) by default
- **Emerging Markets Focus**: Markets for Africa, China, Russia, Southeast Asia, Middle East, Latin America, South Asia
- **Microservices Architecture**: Four-service design separating concerns (Gateway, Engine, Settlement, Oracle)
- **AMM-Based Trading**: Constant Product Market Maker (CPMM) for automated pricing
- **No PII Storage**: Users identified by viewing key hashes, not personal data

---

## System Overview

### Technology Stack

| Component | Technology | Version/Details |
|-----------|------------|-----------------|
| Frontend | React | 19.x (with Vite) |
| Frontend Build | Vite | 7.3.0 |
| Backend Runtime | Node.js | 18 (LTS) - **ASSUMPTION** |
| Backend Framework | Express | Latest |
| Database | PostgreSQL | 15-alpine - **ASSUMPTION** |
| Cache | Redis | 7-alpine |
| Blockchain Integration | Zcash lightwalletd | gRPC protocol |
| Trading Algorithm | CPMM | Constant Product Market Maker |
| Monitoring | Prometheus | v2.47.0 |
| Monitoring UI | Grafana | 10.1.0 |
| Containerization | Docker | Docker Compose |
| CI/CD | GitHub Actions | Workflow-based |

### Project Structure

```
soko-tabiri/
├── docker-compose.yml          # Multi-service orchestration
├── Makefile                    # Development convenience commands
├── .github/
│   └── workflows/
│       └── ci.yml             # CI/CD pipeline
├── services/
│   ├── gateway-api/           # User-facing API (Port 3001)
│   ├── engine/                # AMM & orderbook (Port 3002)
│   ├── settlement/            # Zcash integration (Port 3003)
│   └── oracle/                # Reporter & disputes (Port 3004)
├── migrations/
│   └── 001_init.sql          # Initial database schema
├── monitoring/
│   ├── prometheus.yml        # Prometheus configuration
│   └── grafana/              # Grafana provisioning
├── scripts/
│   ├── prepush-verify.sh     # Pre-push verification
│   └── pre-push.hook         # Git hook
├── shared/                    # Shared utilities (if any)
└── src/                       # Frontend React application
```

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                     │
│                    http://localhost:5173                    │
└───────────────────────────┬───────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Gateway API Service                      │
│                    Port 3001                                │
│  - User-facing endpoints                                    │
│  - CORS handling                                            │
│  - Request routing                                          │
└───────┬───────────────┬───────────────┬─────────────────────┘
        │               │               │
        │ HMAC          │ HMAC          │ HMAC
        │ Auth          │ Auth          │ Auth
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   Engine     │ │  Settlement   │ │   Oracle     │
│  Port 3002   │ │  Port 3003    │ │  Port 3004    │
│              │ │              │ │              │
│ - AMM Math   │ │ - lightwalletd│ │ - Reporters  │
│ - Orderbook  │ │ - KMS/HSM     │ │ - Disputes   │
│ - Trade Exec │ │ - Signing     │ │ - Attestations│
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │   PostgreSQL     │
              │   Port 5432      │
              └─────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │     Redis        │
              │   Port 6379      │
              └─────────────────┘
```

### Service Communication

**Internal Service Authentication:**
- **Method**: HMAC-SHA256
- **Headers**:
  - `X-Soko-Signature`: HMAC signature of request
  - `X-Soko-Timestamp`: Unix timestamp (5-minute tolerance)
- **Secret**: `INTERNAL_HMAC_SECRET` (environment variable)
- **Implementation**: `services/gateway-api/src/lib/service-client.js`

**Service URLs (Internal):**
- Engine: `http://engine:3002`
- Settlement: `http://settlement:3003`
- Oracle: `http://oracle:3004`

---

## Service Details

### 1. Gateway API Service

**Location:** `services/gateway-api/`  
**Port:** 3001  
**Purpose:** User-facing API gateway

**Responsibilities:**
- Handle HTTP requests from frontend
- Route requests to appropriate internal services
- CORS configuration
- Request logging
- Health checks

**Key Files:**
- `src/index.js`: Main Express application
- `src/routes/markets.js`: Market endpoints
- `src/routes/wallets.js`: Wallet/user endpoints
- `src/lib/service-client.js`: Internal service communication

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | API info (service name, version, endpoints) |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/markets` | List all markets |
| GET | `/api/markets/:id` | Get market details |
| POST | `/api/markets/:id/quote` | Get trade quote |
| POST | `/api/markets/:id/trade` | Execute trade |
| POST | `/api/wallet/connect` | Connect wallet (create/retrieve user) |
| GET | `/api/wallet/:id/balance` | Get user balance |
| GET | `/api/wallet/:id/positions` | Get user positions |
| POST | `/api/wallet/:id/faucet` | Request testnet ZEC (dev only) |
| GET | `/api/network/status` | Network status (mock/testnet) |

**Environment Variables:**
- `PORT`: Service port (default: 3001)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `ENGINE_URL`: Internal Engine service URL
- `SETTLEMENT_URL`: Internal Settlement service URL
- `ORACLE_URL`: Internal Oracle service URL
- `INTERNAL_HMAC_SECRET`: Secret for service-to-service auth
- `ALLOWED_ORIGINS`: CORS allowed origins (comma-separated)
- `NODE_ENV`: Environment (development/production)

**Dependencies:**
- Express
- cors
- prom-client (Prometheus metrics)
- pg (PostgreSQL client)
- redis (Redis client)
- dotenv

---

### 2. Engine Service

**Location:** `services/engine/`  
**Port:** 3002  
**Purpose:** Trading engine with AMM and orderbook

**Responsibilities:**
- Calculate trade quotes using CPMM
- Execute trades
- Update market prices
- Manage liquidity pools
- Orderbook matching (stub implementation)

**Key Files:**
- `src/index.js`: Main Express application
- `src/routes/quote.js`: Quote calculation endpoint
- `src/routes/trade.js`: Trade execution endpoint
- `src/amm/index.js`: CPMM implementation
- `src/orderbook/index.js`: Orderbook stub

**AMM Implementation:**

The Engine uses **Constant Product Market Maker (CPMM)** with the formula: `x * y = k`

Where:
- `x` = YES shares in pool
- `y` = NO shares in pool
- `k` = Constant product (invariant)

**Key Functions (from `src/amm/index.js`):**

1. `calculateSharesForAmount(yesShares, noShares, side, amountZat, feeBps)`
   - Calculates shares received for a given ZEC amount
   - Returns: shares, new prices, fee

2. `calculateTrade(yesShares, noShares, side, sharesToBuy, feeBps)`
   - Calculates trade result for buying specific number of shares
   - Returns: new pool state, prices, costs

3. `getPrices(yesShares, noShares)`
   - Returns current market prices from pool state

4. `calculatePayout(shares, avgPrice)`
   - Calculates potential payout for shares

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| POST | `/api/quote` | Calculate trade quote |
| POST | `/api/trade` | Execute trade |

**Trade Execution Flow:**

1. Validate inputs (marketId, userId, side, amountZat)
2. Begin database transaction
3. Lock market and user balance (FOR UPDATE)
4. Check user balance
5. Calculate trade using CPMM
6. Update liquidity pool
7. Update market prices and volume
8. Deduct from user balance
9. Create/update position
10. Create fill record
11. Create settlement job
12. Commit transaction
13. Update Prometheus metrics

**Environment Variables:**
- `PORT`: Service port (default: 3002)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `INTERNAL_HMAC_SECRET`: Secret for service-to-service auth
- `SETTLEMENT_URL`: Settlement service URL (for creating jobs)

**Dependencies:**
- Express
- prom-client
- pg
- redis
- uuid

**Testing:**
- Unit tests: `tests/amm.test.js` (tests CPMM invariants)
- Integration tests: `tests/integration.test.js` (stub)

---

### 3. Settlement Service

**Location:** `services/settlement/`  
**Port:** 3003  
**Purpose:** Zcash blockchain integration

**Responsibilities:**
- Connect to Zcash lightwalletd (gRPC)
- Sign transactions (via KMS/HSM)
- Process settlement jobs
- Generate shielded addresses
- Enforce privacy constraints (shielded-only by default)

**Key Files:**
- `src/index.js`: Main Express application
- `src/routes/jobs.js`: Settlement job endpoints
- `src/lightwalletd/client.js`: lightwalletd gRPC client
- `src/signing/kms.js`: KMS abstraction (mock/production)

**Privacy Constraints:**

1. **Default**: Shielded-only (z-to-z transactions)
2. **Transparent flows**: Only if:
   - `ALLOW_DESHIELD=true`
   - `DESHIELD_KYC=true`
   - User has `kyc_verified=true` in database

**Key Management:**

- **NEVER** store private keys in environment variables
- Keys stored in KMS/HSM (AWS KMS, GCP KMS, Azure Key Vault, HashiCorp Vault)
- `KMS_KEY_ID` references external key, not the key itself
- Mock KMS available for development (`KMS_PROVIDER=mock`)

**Lightwalletd Integration:**

- **Protocol**: gRPC
- **Proto file**: `proto/service.proto` (Zcash lightwalletd protocol)
- **Mock mode**: `MOCK_LIGHTWALLETD=true` (for local dev)
- **Testnet endpoint**: `lightwalletd.testnet.electriccoin.co:9067`
- **Mainnet endpoint**: Configure via `LIGHTWALLETD_URL`

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/api/jobs/:id` | Get settlement job status |
| POST | `/api/jobs` | Create settlement job |
| GET | `/api/network/status` | Zcash network status |
| POST | `/api/address/generate` | Generate shielded address |

**OpenAPI Specification:**
- `openapi.yaml`: Full API specification with request/response schemas

**Environment Variables:**
- `PORT`: Service port (default: 3003)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `INTERNAL_HMAC_SECRET`: Secret for service-to-service auth
- `LIGHTWALLETD_URL`: lightwalletd gRPC endpoint
- `ZCASH_NETWORK`: Network (testnet/mainnet)
- `KMS_KEY_ID`: KMS key identifier
- `KMS_PROVIDER`: KMS provider (mock/aws/gcp/azure/vault)
- `ALLOW_DESHIELD`: Enable transparent transactions (default: false)
- `DESHIELD_KYC`: Require KYC for transparent transactions (default: false)
- `MOCK_LIGHTWALLETD`: Use mock lightwalletd (default: true for dev)

**Dependencies:**
- Express
- prom-client
- pg
- redis
- @grpc/grpc-js
- @grpc/proto-loader

---

### 4. Oracle Service

**Location:** `services/oracle/`  
**Port:** 3004  
**Purpose:** Market resolution and dispute management

**Responsibilities:**
- Manage reporter registration
- Handle attestations (market outcomes)
- Process disputes
- Slash stakes for false attestations
- Track reporter reputation (future)

**Key Files:**
- `src/index.js`: Main Express application
- `src/routes/reporters.js`: Reporter management
- `src/routes/attestations.js`: Attestation endpoints
- `src/routes/disputes.js`: Dispute endpoints

**Reporter System:**

1. **Registration**: Reporters must bond stake (minimum: `MIN_STAKE_ZAT`)
2. **Attestation**: Reporters submit market outcomes
3. **Dispute Window**: Default 24 hours (`DISPUTE_WINDOW_HOURS`)
4. **Slashing**: False attestations result in stake slashing

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |
| POST | `/api/reporters/register` | Register reporter with stake |
| GET | `/api/reporters/:id` | Get reporter details |
| POST | `/api/attestations` | Submit market attestation |
| GET | `/api/attestations/market/:id` | Get attestations for market |
| POST | `/api/disputes` | Challenge attestation |
| GET | `/api/disputes/:id` | Get dispute details |

**OpenAPI Specification:**
- `openapi.yaml`: Full API specification

**Environment Variables:**
- `PORT`: Service port (default: 3004)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `INTERNAL_HMAC_SECRET`: Secret for service-to-service auth
- `SETTLEMENT_URL`: Settlement service URL (for stake slashing)
- `DISPUTE_WINDOW_HOURS`: Dispute window duration (default: 24)
- `MIN_STAKE_ZAT`: Minimum stake for reporters (default: 100000000 = 1 ZEC)

**Dependencies:**
- Express
- prom-client
- pg
- redis

---

## Database Schema

**Database:** PostgreSQL 15 (ASSUMPTION - not specified in original repo)  
**Migration File:** `migrations/001_init.sql`

### Core Tables

#### 1. `users`
- **Purpose**: Ephemeral user mapping (no PII)
- **Key Fields**:
  - `id`: UUID (primary key)
  - `viewing_key_hash`: SHA256 of viewing key (unique, indexed)
  - `kyc_verified`: Boolean (required for t-address flows)
  - `created_at`, `last_active_at`: Timestamps

#### 2. `markets`
- **Purpose**: Prediction markets
- **Key Fields**:
  - `id`: VARCHAR(64) (primary key, e.g., "afr_001")
  - `title`, `description`: Market details
  - `category`, `region`: Classification
  - `yes_price`, `no_price`: Current prices (DECIMAL)
  - `volume_zat`, `liquidity_zat`: Volume/liquidity in zatoshi
  - `end_date`: Market expiration
  - `resolved`, `outcome`: Resolution status

#### 3. `liquidity_pools`
- **Purpose**: AMM pool state
- **Key Fields**:
  - `market_id`: Foreign key to markets
  - `yes_shares`, `no_shares`: Pool shares (BIGINT)
  - `fee_bps`: Fee in basis points (default: 30)

#### 4. `orders`
- **Purpose**: Limit orderbook (stub implementation)
- **Key Fields**:
  - `id`: UUID
  - `user_id`, `market_id`, `side`: Order details
  - `order_type`: 'limit' or 'market'
  - `price`, `quantity`: Order parameters
  - `status`: 'pending', 'filled', 'cancelled'

#### 5. `fills`
- **Purpose**: Trade execution records
- **Key Fields**:
  - `id`: UUID
  - `user_id`, `market_id`, `side`: Trade details
  - `price`, `quantity`: Execution details
  - `amount_zat`, `fee_zat`: Amounts in zatoshi
  - `source`: 'amm' or 'orderbook'

#### 6. `positions`
- **Purpose**: User positions in markets
- **Key Fields**:
  - `user_id`, `market_id`, `side`: Position identifier
  - `shares`: Number of shares (BIGINT)
  - `avg_price`: Average purchase price
  - `cost_basis_zat`: Total cost in zatoshi

#### 7. `balances`
- **Purpose**: User balances
- **Key Fields**:
  - `user_id`: Foreign key to users
  - `available_zat`: Available balance in zatoshi
  - `locked_zat`: Locked balance (for orders)
  - `pending_deposit_zat`, `pending_withdrawal_zat`: Pending operations

#### 8. `oracle_reporters`
- **Purpose**: Registered reporters
- **Key Fields**:
  - `id`: UUID
  - `user_id`: Reporter user
  - `stake_zat`: Bonded stake
  - `reputation_score`: Future feature

#### 9. `oracle_attestations`
- **Purpose**: Market outcome attestations
- **Key Fields**:
  - `id`: UUID
  - `reporter_id`: Foreign key to reporters
  - `market_id`: Market being attested
  - `outcome`: 'yes', 'no', or 'invalid'
  - `source_url`: Evidence URL
  - `disputed`: Boolean flag

#### 10. `oracle_disputes`
- **Purpose**: Dispute challenges
- **Key Fields**:
  - `id`: UUID
  - `attestation_id`: Foreign key to attestations
  - `challenger_id`: User challenging
  - `reason`: Dispute reason
  - `status`: 'pending', 'resolved', 'rejected'

#### 11. `settlement_jobs`
- **Purpose**: Zcash transaction jobs
- **Key Fields**:
  - `id`: UUID
  - `job_type`: 'trade_settlement', 'stake_slash', etc.
  - `fill_id`: Associated fill (if trade)
  - `status`: 'pending', 'processing', 'completed', 'failed'
  - `tx_hash`: Zcash transaction hash (when completed)

### Indexes

- `idx_users_viewing_key_hash`: Fast user lookup
- `idx_markets_category`, `idx_markets_region`: Market filtering
- `idx_markets_resolved`: Filter resolved markets
- `idx_positions_user_market`: Position lookup

### Constraints

- Foreign keys enforce referential integrity
- CHECK constraints validate enums (side: 'yes'/'no', outcome: 'yes'/'no'/'invalid')
- UNIQUE constraints on composite keys (positions: user_id + market_id + side)

---

## Privacy and Security

### Privacy Architecture

**Shielded-First Design:**
- Default: All transactions use Zcash shielded addresses (z-to-z)
- Transparent addresses only with explicit flags:
  - `ALLOW_DESHIELD=true`
  - `DESHIELD_KYC=true`
  - User `kyc_verified=true`

**No PII Storage:**
- Users identified by `viewing_key_hash` (SHA256), not personal data
- Viewing keys never stored (only hashes)
- Addresses derived at runtime, not stored

**Privacy Controls:**
- Gateway API: No direct Zcash key access
- Engine: Pure math, no blockchain access
- Settlement: Only service with key access (via KMS)
- Oracle: No key access

### Security Measures

**1. Key Management:**
- Keys stored in KMS/HSM only
- `KMS_KEY_ID` is a reference, not the key
- Mock KMS for development only

**2. Service Authentication:**
- HMAC-SHA256 signatures
- Timestamp validation (5-minute window)
- Constant-time comparison (prevents timing attacks)

**3. Database Security:**
- Parameterized queries (prepared statements)
- Connection strings in environment variables
- Sensitive data hashed (viewing keys)

**4. API Security:**
- CORS restricted to allowed origins
- Input validation on all endpoints
- Error messages don't leak internal details in production

**Threat Model:**
See `THREAT_MODEL.md` for detailed threat analysis and mitigations.

**Security Policy:**
See `SECURITY.md` for security reporting and checklist.

---

## Development Pipeline

### Local Development Setup

**Prerequisites:**
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Make (optional, for convenience)

**Quick Start:**
```bash
git clone https://github.com/Odhiambo526/soko-tabiri.git
cd soko-tabiri
cp .env.example .env
make dev-up
```

**Makefile Commands:**

| Command | Description |
|---------|-------------|
| `make dev-up` | Start all services (docker-compose up --build) |
| `make dev-down` | Stop all services |
| `make dev-logs` | Tail logs from all services |
| `make dev-monitoring` | Start with Prometheus/Grafana |
| `make test` | Run all tests |
| `make test-unit` | Run unit tests only |
| `make lint` | Run linters |
| `make verify` | Pre-push verification (lint, test, secrets) |
| `make install-hooks` | Install git pre-push hook |

### Git Workflow

**Pre-Push Verification:**
- Script: `scripts/prepush-verify.sh`
- Hook: `scripts/pre-push.hook`
- Checks:
  1. Lint all services
  2. Run unit tests
  3. Docker build verification
  4. Secret scanning (grep for common patterns)
  5. Documentation checks
  6. Generate AI review bundle

**AI Review Bundle:**
- Location: `prepush_review/`
- Prompt: `prepush_review/ai_review_prompt.txt`
- Includes: Staged files, diff, context

### CI/CD Pipeline

**Location:** `.github/workflows/ci.yml`

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

**Jobs:**

1. **lint** (Ubuntu latest)
   - Setup Node.js 18 with npm cache
   - Install dependencies for all services
   - Run linters (non-blocking: `|| true`)

2. **unit-tests** (Ubuntu latest)
   - Setup Node.js 18
   - Install Engine dependencies
   - Run AMM unit tests (`npm test`)

3. **docker-build** (Ubuntu latest)
   - Setup Docker Buildx
   - Build all service images:
     - gateway-api
     - engine
     - settlement
     - oracle
   - Use GitHub Actions cache for layers

4. **integration-test** (Ubuntu latest)
   - Depends on: unit-tests, docker-build
   - Create `.env` file with test config
   - Start all services (`docker-compose up -d --build`)
   - Wait 30 seconds for startup
   - Health check all services:
     - Gateway: `http://localhost:3001/health`
     - Engine: `http://localhost:3002/health`
     - Settlement: `http://localhost:3003/health`
     - Oracle: `http://localhost:3004/health`
   - Smoke test: List markets API
   - On failure: View service logs
   - Always: Stop services and remove volumes

5. **security-scan** (Ubuntu latest)
   - Run Trivy vulnerability scanner
   - Scan filesystem for CRITICAL/HIGH vulnerabilities
   - Non-blocking (`exit-code: '0'`)

**Environment Variables (CI):**
- `NODE_VERSION`: '18'
- `MOCK_LIGHTWALLETD`: 'true'
- `POSTGRES_USER`: soko
- `POSTGRES_PASSWORD`: soko_test_password
- `POSTGRES_DB`: soko_tabiri_test

**Dependency Caching:**
- Uses `package-lock.json` files for npm cache
- Files must exist in repository (not in `.gitignore`)
- Cache paths:
  - `services/gateway-api/package-lock.json`
  - `services/engine/package-lock.json`
  - `services/settlement/package-lock.json`
  - `services/oracle/package-lock.json`

### Testing

**Unit Tests:**
- Location: `services/engine/tests/amm.test.js`
- Tests CPMM invariants:
  - Constant product maintained after trades
  - Price calculations
  - Fee calculations
- Run: `cd services/engine && npm test`

**Integration Tests:**
- Location: `services/engine/tests/integration.test.js` (stub)
- Future: End-to-end trade-settlement flow

**Manual Testing:**
```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health

# List markets
curl http://localhost:3001/api/markets

# Get quote
curl -X POST http://localhost:3001/api/markets/latam_001/quote \
  -H "Content-Type: application/json" \
  -d '{"side":"yes","amountZec":10}'
```

---

## Deployment

### Docker Compose Deployment

**File:** `docker-compose.yml`

**Services:**
1. **postgres**: PostgreSQL 15-alpine
   - Volume: `postgres_data`
   - Port: 5432
   - Health check: `pg_isready`

2. **redis**: Redis 7-alpine
   - Volume: `redis_data`
   - Port: 6379
   - Health check: `redis-cli ping`

3. **gateway-api**: Custom image
   - Port: 3001
   - Depends on: postgres, redis
   - Health check: HTTP GET `/health`

4. **engine**: Custom image
   - Port: 3002
   - Depends on: postgres, redis
   - Health check: HTTP GET `/health`

5. **settlement**: Custom image
   - Port: 3003
   - Depends on: postgres, redis
   - Health check: HTTP GET `/health`

6. **oracle**: Custom image
   - Port: 3004
   - Depends on: postgres, redis
   - Health check: HTTP GET `/health`

**Optional Services (Profiles):**

- **prometheus**: Monitoring (profile: `monitoring`)
- **grafana**: Monitoring UI (profile: `monitoring`)
- **frontend**: React app (profile: `frontend`)

**Network:**
- All services on `soko-network` (bridge driver)

**Volumes:**
- `postgres_data`: Database persistence
- `redis_data`: Redis persistence
- `prometheus_data`: Metrics storage
- `grafana_data`: Grafana configuration

### Dockerfile Structure

Each service has a `Dockerfile` with:
1. Base image: `node:18-alpine`
2. Install `wget` (for health checks)
3. Copy `package*.json`
4. Run `npm install --omit=dev` (production dependencies)
5. Copy application code
6. Create non-root user
7. Expose port
8. Health check command
9. Start command: `node src/index.js`

**Example:** `services/gateway-api/Dockerfile`

### Environment Configuration

**File:** `.env` (not in repository)

**Required Variables:**
- `POSTGRES_USER`: Database user
- `POSTGRES_PASSWORD`: Database password
- `POSTGRES_DB`: Database name
- `INTERNAL_HMAC_SECRET`: Service-to-service auth secret

**Optional Variables:**
- `NODE_ENV`: Environment (development/production)
- `LIGHTWALLETD_URL`: lightwalletd endpoint
- `MOCK_LIGHTWALLETD`: Use mock mode (true/false)
- `KMS_KEY_ID`: KMS key identifier
- `KMS_PROVIDER`: KMS provider (mock/aws/gcp/azure/vault)
- `ALLOW_DESHIELD`: Enable transparent transactions
- `DESHIELD_KYC`: Require KYC for transparent transactions

**Production Checklist:**
See `OPERATIONAL_RUNBOOK.md` for deployment checklist.

---

## Monitoring and Operations

### Prometheus Configuration

**File:** `monitoring/prometheus.yml`

**Scrape Targets:**
- Gateway: `http://gateway-api:3001/metrics`
- Engine: `http://engine:3002/metrics`
- Settlement: `http://settlement:3003/metrics`
- Oracle: `http://oracle:3004/metrics`

**Metrics Exposed:**
- Default Node.js metrics (CPU, memory, event loop)
- Custom metrics:
  - `soko_engine_trades_total`: Trade count
  - `soko_settlement_pending_jobs`: Pending settlement jobs
  - `soko_oracle_active_reporters`: Active reporters
  - `soko_oracle_disagreement_rate`: Reporter disagreement rate

### Grafana Configuration

**Location:** `monitoring/grafana/provisioning/`

**Datasource:**
- `datasources/datasources.yml`: Prometheus datasource

**Dashboards:**
- `dashboards/dashboards.yml`: Dashboard provisioning
- `dashboards/soko-tabiri.json`: Sample dashboard

**Access:**
- URL: `http://localhost:3000`
- Default credentials: admin/admin

### Operational Procedures

**See:** `OPERATIONAL_RUNBOOK.md` for:
- Service management
- Database operations
- Redis operations
- Troubleshooting
- Emergency procedures

**Key Commands:**
```bash
# View logs
docker-compose logs -f <service-name>

# Restart service
docker-compose restart <service-name>

# Database backup
docker-compose exec postgres pg_dump -U soko soko_tabiri > backup.sql

# Check settlement jobs
docker-compose exec postgres psql -U soko -d soko_tabiri \
  -c "SELECT status, COUNT(*) FROM settlement_jobs GROUP BY status;"
```

---

## Assumptions and Limitations

### Assumptions Made

1. **Node.js 18 (LTS)**: Not specified in original repo, assumed for compatibility
2. **PostgreSQL 15**: Not specified, assumed for modern features
3. **Package Versions**: See individual `package.json` files for exact versions
4. **Resolution Sources**: Market resolution sources marked as "EXAMPLE SOURCE - verify before use"

### Known Limitations

1. **Orderbook**: Stub implementation (`services/engine/src/orderbook/index.js`)
2. **Integration Tests**: Stub implementation
3. **Reporter Reputation**: Not yet implemented
4. **Multi-Reporter Consensus**: Not yet implemented
5. **Rate Limiting**: Not implemented
6. **TLS/HTTPS**: Not configured (development only)
7. **Load Balancing**: Not configured
8. **Auto-scaling**: Not configured

### Future Enhancements

- Full orderbook implementation
- Reporter reputation system
- Multi-reporter consensus
- Governance for disputed outcomes
- Tor/I2P support for network-level privacy
- Amount obfuscation
- Multi-signature for large transactions
- Hardware security module (HSM) integration

---

## Conclusion

Soko Tabiri is a privacy-preserving prediction market platform built with a microservices architecture. The system separates concerns across four services (Gateway, Engine, Settlement, Oracle) and enforces privacy through Zcash shielded transactions by default.

The development pipeline includes automated testing, linting, Docker builds, and integration smoke tests via GitHub Actions. The system is designed for deployment using Docker Compose, with optional monitoring via Prometheus and Grafana.

**Key Strengths:**
- Privacy-first architecture
- Clear separation of concerns
- Comprehensive documentation
- Automated CI/CD pipeline
- Operational runbooks

**Areas for Improvement:**
- Complete orderbook implementation
- Full integration test suite
- Production hardening (TLS, rate limiting, etc.)
- Enhanced monitoring and alerting

---

**Document Version:** 1.0  
**Last Updated:** January 1, 2026  
**Maintained By:** Development Team  
**Repository:** https://github.com/Odhiambo526/soko-tabiri

