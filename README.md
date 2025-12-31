# Soko Tabiri 🌍

**Private Prediction Markets for Emerging Economies** - Built on Zcash

![Zcash](https://img.shields.io/badge/Powered%20by-Zcash-F4B728?style=flat-square)
![Network](https://img.shields.io/badge/Network-Testnet-blue?style=flat-square)

## Overview

Soko Tabiri ("Market Prediction" in Swahili) is a privacy-preserving prediction market platform focusing on regions underserved by existing platforms like Polymarket—Africa, China, Japan, Russia, Southeast Asia, Middle East, Latin America, and South Asia.

### Why Privacy Matters

Unlike Polymarket (Polygon) where every bet is publicly visible, Soko Tabiri uses Zcash's shielded transactions to protect user privacy. This is critical for:

- **Political predictions** in regions with surveillance concerns
- **Economic forecasts** that could reveal business intelligence
- **Sensitive markets** where public exposure has real consequences

## Regions Covered

| Region | Example Markets |
|--------|-----------------|
| 🌍 **Africa** | Nigeria Naira, South Africa load shedding, Kenya M-Pesa, Ethiopia GERD |
| 🇷🇺 **Russia & CIS** | Ruble exchange rate, Gazprom exports, Kazakhstan AIFC |
| 🇨🇳 **China** | GDP growth, BYD vs Tesla, Evergrande, Hang Seng, TSMC |
| 🇯🇵 **Japan** | BOJ interest rates, USD/JPY, Nikkei 225, Toyota |
| 🌏 **Southeast Asia** | Indonesia Nusantara, Vietnam GDP, Thailand casinos |
| 🏜️ **Middle East** | Saudi NEOM, UAE dirham, Iran-Saudi relations |
| 🌎 **Latin America** | Argentina inflation, Brazil World Cup, Mexico peso |
| 🇮🇳 **South Asia** | India GDP ranking, Jio satellite, Pakistan IMF |

## Features

- 🛡️ **Private Trading** - Shielded transactions via Zcash zk-SNARKs
- 🌍 **Global Coverage** - Markets Polymarket doesn't touch
- 💱 **AMM Trading** - Constant Product Market Maker for instant liquidity
- 💰 **Testnet Faucet** - Get test ZEC to try the platform
- 📱 **Mobile-First** - Responsive PWA design

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone https://github.com/Odhiambo526/soko-tabiri.git
cd soko-tabiri

# Frontend
npm install

# Backend
cd backend
npm install
```

### Running

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Open http://localhost:5173

## Usage

1. **Connect Wallet** - Click "Connect Zcash"
2. **Get Test ZEC** - Click the faucet button (💧)
3. **Browse Markets** - Filter by region (Africa, China, Japan, etc.)
4. **Trade** - Buy YES or NO shares on any market
5. **Track Portfolio** - View positions and P&L

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18, Vite, Framer Motion |
| Backend | Node.js, Express, SQLite |
| Blockchain | Zcash (lightwalletd gRPC) |
| Trading | CPMM (Uniswap-style AMM) |

## API Endpoints

```
GET  /api/markets              - List all markets
GET  /api/markets/:id          - Market details
POST /api/markets/:id/quote    - Get trade quote
POST /api/markets/:id/trade    - Execute trade
POST /api/wallet/connect       - Connect wallet
POST /api/wallet/:id/faucet    - Request testnet ZEC
GET  /api/network/status       - Network status
```

## License

MIT

---

**Global Markets, Zero Exposure** 🛡️
