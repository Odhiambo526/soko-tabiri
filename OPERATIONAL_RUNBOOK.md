# Operational Runbook

## Overview

This runbook provides operational procedures for running Soko Tabiri in development and production environments.

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Make (optional, for convenience commands)

### Local Development

```bash
# Clone repository
git clone https://github.com/Odhiambo526/soko-tabiri.git
cd soko-tabiri

# Copy environment file
cp .env.example .env

# Start all services
make dev-up
# Or: docker-compose -f docker-compose.yml up --build

# Run tests
make test
# Or: cd services/engine && npm test
```

### Verify Services

```bash
# Health checks
curl http://localhost:3001/health  # Gateway
curl http://localhost:3002/health  # Engine
curl http://localhost:3003/health  # Settlement
curl http://localhost:3004/health  # Oracle

# List markets
curl http://localhost:3001/api/markets
```

---

## Lightwalletd Setup

### Option 1: Mock Mode (Local Development)

Set in `.env`:
```
MOCK_LIGHTWALLETD=true
ZCASH_NETWORK=testnet
```

This simulates lightwalletd responses without connecting to the Zcash network.

### Option 2: Public Testnet Endpoint

Set in `.env`:
```
MOCK_LIGHTWALLETD=false
LIGHTWALLETD_URL=lightwalletd.testnet.electriccoin.co:9067
ZCASH_NETWORK=testnet
```

### Option 3: Self-Hosted Lightwalletd

1. **Install zcashd**:
```bash
# Ubuntu/Debian
sudo apt-get install zcash

# Initialize
zcash-fetch-params
```

2. **Configure zcashd** (`~/.zcash/zcash.conf`):
```
testnet=1
server=1
rpcuser=zcashrpc
rpcpassword=<secure-password>
```

3. **Start zcashd**:
```bash
zcashd -daemon
```

4. **Install lightwalletd**:
```bash
git clone https://github.com/zcash/lightwalletd.git
cd lightwalletd
go build
```

5. **Run lightwalletd**:
```bash
./lightwalletd \
  --zcash-conf-path ~/.zcash/zcash.conf \
  --data-dir ./data \
  --log-file ./lightwalletd.log \
  --grpc-bind-addr 0.0.0.0:9067
```

6. **Update `.env`**:
```
MOCK_LIGHTWALLETD=false
LIGHTWALLETD_URL=localhost:9067
ZCASH_NETWORK=testnet
```

---

## Service Management

### Start Services

```bash
# All services
docker-compose -f docker-compose.yml up -d

# With monitoring (Prometheus + Grafana)
docker-compose -f docker-compose.yml --profile monitoring up -d

# Individual service
docker-compose -f docker-compose.yml up -d gateway-api
```

### Stop Services

```bash
# All services
docker-compose -f docker-compose.yml down

# With volumes (reset data)
docker-compose -f docker-compose.yml down -v
```

### View Logs

```bash
# All services
docker-compose -f docker-compose.yml logs -f

# Specific service
docker-compose -f docker-compose.yml logs -f settlement
```

### Restart Service

```bash
docker-compose -f docker-compose.yml restart engine
```

---

## Database Operations

### Connect to PostgreSQL

```bash
docker-compose -f docker-compose.yml exec postgres psql -U soko -d soko_tabiri
```

### Run Migrations

```bash
# Migrations run automatically on container start
# Manual run:
docker-compose -f docker-compose.yml exec postgres \
  psql -U soko -d soko_tabiri -f /docker-entrypoint-initdb.d/001_init.sql
```

### Backup Database

```bash
docker-compose -f docker-compose.yml exec postgres \
  pg_dump -U soko soko_tabiri > backup_$(date +%Y%m%d).sql
```

### Restore Database

```bash
cat backup_20260101.sql | docker-compose -f docker-compose.yml exec -T postgres \
  psql -U soko -d soko_tabiri
```

---

## Redis Operations

### Connect to Redis

```bash
docker-compose -f docker-compose.yml exec redis redis-cli
```

### Flush Cache

```bash
docker-compose -f docker-compose.yml exec redis redis-cli FLUSHALL
```

---

## Monitoring

### Prometheus

- URL: http://localhost:9090
- Metrics endpoints:
  - Gateway: http://localhost:3001/metrics
  - Engine: http://localhost:3002/metrics
  - Settlement: http://localhost:3003/metrics
  - Oracle: http://localhost:3004/metrics

### Grafana

- URL: http://localhost:3000
- Default credentials: admin/admin
- Dashboards: Pre-provisioned "Soko Tabiri Dashboard"

### Key Metrics to Monitor

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `soko_settlement_pending_jobs` | Pending settlement jobs | > 50 |
| `soko_engine_trades_total` | Trade count | Sudden drop |
| `soko_oracle_disagreement_rate` | Reporter disagreement | > 0.3 |
| `soko_oracle_active_reporters` | Active reporters | < 3 |

---

## Troubleshooting

### Service Won't Start

1. Check logs:
```bash
docker-compose -f docker-compose.yml logs <service-name>
```

2. Verify environment variables:
```bash
docker-compose -f docker-compose.yml config
```

3. Check port conflicts:
```bash
lsof -i :3001  # Gateway port
```

### Database Connection Failed

1. Verify PostgreSQL is running:
```bash
docker-compose -f docker-compose.yml ps postgres
```

2. Check connection string:
```bash
docker-compose -f docker-compose.yml exec gateway-api printenv DATABASE_URL
```

3. Test connection:
```bash
docker-compose -f docker-compose.yml exec postgres pg_isready -U soko
```

### Lightwalletd Connection Failed

1. Check mock mode:
```bash
docker-compose -f docker-compose.yml exec settlement printenv MOCK_LIGHTWALLETD
```

2. Test lightwalletd endpoint:
```bash
grpcurl -plaintext lightwalletd.testnet.electriccoin.co:9067 \
  cash.z.wallet.sdk.rpc.CompactTxStreamer/GetLightdInfo
```

### Settlement Jobs Stuck

1. Check job status:
```bash
docker-compose -f docker-compose.yml exec postgres \
  psql -U soko -d soko_tabiri -c "SELECT status, COUNT(*) FROM settlement_jobs GROUP BY status;"
```

2. View failed jobs:
```bash
docker-compose -f docker-compose.yml exec postgres \
  psql -U soko -d soko_tabiri -c "SELECT * FROM settlement_jobs WHERE status = 'failed' LIMIT 10;"
```

3. Retry failed jobs:
```bash
docker-compose -f docker-compose.yml exec postgres \
  psql -U soko -d soko_tabiri -c "UPDATE settlement_jobs SET status = 'pending', retry_count = 0 WHERE status = 'failed';"
```

---

## Emergency Procedures

### Stop All Trading

1. Stop engine service:
```bash
docker-compose -f docker-compose.yml stop engine
```

2. Gateway will return 503 for trade requests

### Rotate Secrets

1. Generate new HMAC secret:
```bash
openssl rand -hex 32
```

2. Update `.env` with new `INTERNAL_HMAC_SECRET`

3. Restart all services:
```bash
docker-compose -f docker-compose.yml up -d --force-recreate
```

### Database Recovery

1. Stop services:
```bash
docker-compose -f docker-compose.yml down
```

2. Remove corrupted volume:
```bash
docker volume rm soko-tabiri_postgres_data
```

3. Restore from backup:
```bash
docker-compose -f docker-compose.yml up -d postgres
cat backup.sql | docker-compose -f docker-compose.yml exec -T postgres psql -U soko -d soko_tabiri
docker-compose -f docker-compose.yml up -d
```

---

## Production Checklist

Before deploying to production:

- [ ] Replace all default passwords and secrets
- [ ] Configure KMS provider (not `mock`)
- [ ] Enable TLS for all services
- [ ] Set up load balancer with SSL termination
- [ ] Configure auto-scaling
- [ ] Set up log aggregation (ELK, Datadog, etc.)
- [ ] Configure alerting (PagerDuty, OpsGenie, etc.)
- [ ] Set up backup automation
- [ ] Review and restrict network access
- [ ] Enable rate limiting
- [ ] Configure CDN for frontend
- [ ] Set up disaster recovery plan

