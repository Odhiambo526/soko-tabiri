# Soko Tabiri 🌍

**Private Prediction Markets for Emerging Economies** - Built on Zcash

![Zcash](https://img.shields.io/badge/Powered%20by-Zcash-F4B728?style=flat-square)
![Network](https://img.shields.io/badge/Network-Testnet-blue?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## Overview

Soko Tabiri ("Market Prediction" in Swahili) is a privacy-preserving prediction market platform focusing on regions underserved by existing platforms—Africa, China, Japan, Russia, Southeast Asia, Middle East, Latin America, and South Asia.

### Why Privacy Matters

Unlike Polymarket (Polygon) where every bet is publicly visible, Soko Tabiri uses Zcash's shielded transactions to protect user privacy. This is critical for:

- **Political predictions** in regions with surveillance concerns
- **Economic forecasts** that could reveal business intelligence
- **Sensitive markets** where public exposure has real consequences

## Architecture

Soko Tabiri uses a four-service microservices architecture:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Gateway    │────▶│   Engine    │
│   (React)   │     │    API      │     │ (AMM/Order) │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Oracle    │     │ Settlement  │
                    │  (Dispute)  │     │(Lightwalletd)│
                    └─────────────┘     └─────────────┘
```

| Service | Port | Description |
|---------|------|-------------|
| Gateway API | 3001 | User-facing API, routes requests |
| Engine | 3002 | AMM math, orderbook matching |
| Settlement | 3003 | Zcash lightwalletd adapter, signing |
| Oracle | 3004 | Reporter management, disputes |

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Make (optional)

### Start Services

```bash
# Clone repository
git clone https://github.com/Odhiambo526/soko-tabiri.git
cd soko-tabiri

# Copy environment file
cp .env.example .env

# Start all services
make dev-up
# Or: docker-compose -f docker-compose.yml up --build
```

### Verify Health

```bash
curl http://localhost:3001/health  # Gateway
curl http://localhost:3002/health  # Engine
curl http://localhost:3003/health  # Settlement
curl http://localhost:3004/health  # Oracle
```

### Run Tests

```bash
make test
# Or: cd services/engine && npm test
```

## API Endpoints

### Gateway API (Port 3001)

```
GET  /api/markets              - List all markets
GET  /api/markets/:id          - Market details
POST /api/markets/:id/quote    - Get trade quote
POST /api/markets/:id/trade    - Execute trade
POST /api/wallet/connect       - Connect wallet
GET  /api/wallet/:id/balance   - Get balance
GET  /api/wallet/:id/positions - Get positions
POST /api/wallet/:id/faucet    - Request testnet ZEC
```

### Metrics & Health

All services expose:
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

## Privacy Constraints

Soko Tabiri enforces **shielded-first privacy**:

1. **Default**: All transactions use shielded addresses (z-to-z)
2. **Transparent flows**: Only available with explicit flags:
   - `ALLOW_DESHIELD=true` - Enable transparent transactions
   - `DESHIELD_KYC=true` - Require KYC verification
3. **Key management**: Keys stored in KMS/HSM, never in environment variables

## Monitoring

Start with monitoring stack:

```bash
make dev-monitoring
# Or: docker-compose --profile monitoring up -d
```

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)

## Documentation

- [SECURITY.md](./SECURITY.md) - Security policy and measures
- [THREAT_MODEL.md](./THREAT_MODEL.md) - Top 6 threats and mitigations
- [OPERATIONAL_RUNBOOK.md](./OPERATIONAL_RUNBOOK.md) - Operational procedures

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 19, Vite, Framer Motion |
| Backend | Node.js 18, Express |
| Database | PostgreSQL 15 |
| Cache | Redis 7 |
| Blockchain | Zcash (lightwalletd gRPC) |
| Trading | CPMM (Constant Product AMM) |
| Monitoring | Prometheus, Grafana |

## ASSUMPTIONS

The following assumptions were made during implementation:

1. **Node.js 18 (LTS)** - Not specified in original repo
2. **PostgreSQL 15** - Not specified in original repo
3. **Package versions**: See individual `package.json` files for specific versions
4. **Resolution sources**: Marked as "EXAMPLE SOURCE - verify before use"

## Regions Covered

| Region | Example Markets |
|--------|-----------------|
| 🌍 **Africa** | Nigeria Naira, South Africa load shedding, Kenya M-Pesa |
| 🇷🇺 **Russia & CIS** | Ruble exchange rate, Gazprom exports |
| 🇨🇳 **China** | GDP growth, BYD vs Tesla, TSMC |
| 🇯🇵 **Japan** | BOJ interest rates, USD/JPY |
| 🌏 **Southeast Asia** | Indonesia Nusantara, Thailand casinos |
| 🏜️ **Middle East** | Saudi NEOM, UAE dirham |
| 🌎 **Latin America** | Argentina inflation, Brazil |
| 🇮🇳 **South Asia** | India GDP ranking, Jio satellite |

## Development

### Project Structure

```
soko-tabiri/
├── docker-compose.yml
├── Makefile
├── services/
│   ├── gateway-api/
│   ├── engine/
│   ├── settlement/
│   └── oracle/
├── migrations/
├── monitoring/
└── .github/workflows/
```

### Running Individual Services

```bash
# Gateway API
cd services/gateway-api && npm run dev

# Engine
cd services/engine && npm run dev

# Settlement
cd services/settlement && npm run dev

# Oracle
cd services/oracle && npm run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes
4. Run tests: `make test`
5. Submit a pull request

## License

MIT

---

**Global Markets, Zero Exposure** 🛡️
