import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import db from './db/index.js';
import zcash from './services/zcash.js';
import marketsRouter from './routes/markets.js';
import walletRouter from './routes/wallet.js';
import networkRouter from './routes/network.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    zcash: {
      connected: zcash.connected,
      network: zcash.network
    }
  });
});

// API Routes
app.use('/api/markets', marketsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/network', networkRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.close();
  process.exit(0);
});

// Start server
async function start() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                     SOKO TABIRI                           ║');
  console.log('║         Kenya\'s Zcash-Powered Prediction Market           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize database
  const dbPath = process.env.DB_PATH || './data/soko_tabiri.db';
  db.init(path.resolve(__dirname, '..', dbPath));

  // Connect to Zcash lightwalletd
  const lightdHost = process.env.LIGHTWALLETD_HOST || 'lightwalletd.testnet.electriccoin.co';
  const lightdPort = process.env.LIGHTWALLETD_PORT || 9067;
  
  await zcash.init(lightdHost, lightdPort);

  // Start Express server
  app.listen(PORT, () => {
    console.log('');
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📊 API endpoints:`);
    console.log(`   GET  /api/markets          - List all markets`);
    console.log(`   GET  /api/markets/:id      - Get market details`);
    console.log(`   POST /api/markets/:id/quote - Get trade quote`);
    console.log(`   POST /api/markets/:id/trade - Execute trade`);
    console.log(`   POST /api/wallet/connect   - Connect wallet`);
    console.log(`   POST /api/wallet/:id/faucet - Get testnet ZEC`);
    console.log(`   GET  /api/network/status   - Network status`);
    console.log('');
    console.log(`🔗 Zcash Network: ${zcash.network}`);
    console.log(`🛡️  Privacy: Shielded transactions supported`);
    console.log('');
  });
}

start().catch(console.error);

