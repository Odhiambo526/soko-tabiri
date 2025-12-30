# Soko Tabiri 🇰🇪

**Kenya's First Privacy-Focused Prediction Market** - Built on Zcash

![Zcash](https://img.shields.io/badge/Powered%20by-Zcash-F4B728?style=flat-square)
![Network](https://img.shields.io/badge/Network-Testnet-blue?style=flat-square)

## Overview

Soko Tabiri ("Market Prediction" in Swahili) is a decentralized prediction market platform focused on Kenyan events - economy, sports, politics, technology, and more. Built on Zcash for financial privacy using shielded transactions.

### Why Zcash?

Based on [Zcash documentation](https://zcash.readthedocs.io/en/latest/rtd_pages/basics.html):

- **Shielded Transactions (z-to-z)**: Encrypts sender, receiver, and amount
- **Viewing Keys**: Selective disclosure for auditing while maintaining privacy
- **Low Fees**: 0.0001 ZEC default transaction fee
- **zk-SNARKs**: Zero-knowledge proofs for verification without revealing data

## Features

- 🛡️ **Private Trading** - Shielded transactions via Zcash
- 📊 **Kenyan Markets** - Economy, Sports, Tech, Finance, Infrastructure
- 💱 **AMM Trading** - Constant Product Market Maker (like Uniswap)
- 💰 **Testnet Faucet** - Get test ZEC to try the platform
- 📱 **Responsive UI** - Works on desktop and mobile

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd soko-tabiri

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

1. **Connect Wallet** - Click "Connect Zcash" to create a wallet
2. **Get Test ZEC** - Click the faucet button (💧) to receive 5 testnet ZEC
3. **Browse Markets** - View Kenyan prediction markets
4. **Trade** - Click any market to buy YES or NO shares
5. **Track Portfolio** - View your positions and P&L

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/markets` | List all markets |
| GET | `/api/markets/:id` | Get market details |
| POST | `/api/markets/:id/quote` | Get trade quote |
| POST | `/api/markets/:id/trade` | Execute trade |
| POST | `/api/wallet/connect` | Connect/create wallet |
| GET | `/api/wallet/:id/balance` | Get balance |
| GET | `/api/wallet/:id/positions` | Get positions |
| POST | `/api/wallet/:id/faucet` | Request testnet ZEC |
| GET | `/api/network/status` | Network status |

## Architecture

```
soko-tabiri/
├── src/                    # React Frontend
│   ├── components/         # UI Components
│   ├── services/           # API Service
│   └── data/               # Mock data
├── backend/
│   ├── src/
│   │   ├── db/             # SQLite database
│   │   ├── routes/         # API routes
│   │   └── services/
│   │       ├── zcash.js    # Zcash lightwalletd client
│   │       └── amm.js      # Market maker logic
│   └── proto/              # gRPC protobuf definitions
```

## Zcash Integration

The backend connects to Zcash via [lightwalletd](https://zcash.readthedocs.io/en/latest/rtd_pages/lightclient_support.html):

- **Testnet Server**: `lightwalletd.testnet.electriccoin.co:9067`
- **Protocol**: gRPC (CompactTxStreamer)
- **Address Types**:
  - `t-address` (transparent): Like Bitcoin
  - `z-address` (shielded): Private transactions

### Real Testnet ZEC

For real testnet ZEC, use the official faucet:
https://faucet.testnet.z.cash/

## Market Mechanics

Uses **Constant Product Market Maker (CPMM)**:

```
x * y = k

where:
  x = YES shares in pool
  y = NO shares in pool
  k = constant product
```

- Prices adjust based on supply/demand
- Each share pays 1 ZEC if the outcome is correct
- Prices represent implied probabilities

## Configuration

Edit `backend/.env`:

```env
PORT=3001
ZCASH_NETWORK=testnet
LIGHTWALLETD_HOST=lightwalletd.testnet.electriccoin.co
LIGHTWALLETD_PORT=9067
```

## Production Deployment

For production:

1. Switch to mainnet lightwalletd
2. Implement proper HD wallet derivation
3. Add transaction signing with user's private keys
4. Enable TLS for gRPC connections
5. Add rate limiting and authentication

## Resources

- [Zcash Documentation](https://zcash.readthedocs.io/)
- [Zcash Integration Guide](https://zcash.readthedocs.io/en/latest/rtd_pages/zig.html)
- [Light Client Support](https://zcash.readthedocs.io/en/latest/rtd_pages/lightclient_support.html)
- [Testnet Faucet](https://faucet.testnet.z.cash/)

## License

MIT

---

**Hakuna Matata, Hakuna Surveillance** 🛡️
