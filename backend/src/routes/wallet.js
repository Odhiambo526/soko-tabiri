import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import zcash from '../services/zcash.js';

const router = Router();

/**
 * POST /api/wallet/connect
 * Connect/create a wallet for user
 * In production, this would verify a signed message from the user's wallet
 */
router.post('/connect', (req, res) => {
  try {
    const { viewingKey } = req.body;

    // Check if user exists
    let user = viewingKey ? db.getUserByViewingKey(viewingKey) : null;

    if (!user) {
      // Create new user
      const userId = uuidv4();
      const addresses = zcash.generateTestnetAddress(userId);
      
      db.createUser(
        userId,
        addresses.viewingKey,
        addresses.transparent,
        addresses.shielded
      );

      // Initialize balance
      db.updateBalance(userId, 0, 0);

      user = db.getUserById(userId);
    }

    const balance = db.getBalance(user.id);

    res.json({
      success: true,
      user: {
        id: user.id,
        transparentAddress: user.transparent_address,
        shieldedAddress: user.shielded_address,
        viewingKey: user.viewing_key
      },
      balance: {
        available: zcash.zatToZec(balance.available_zat),
        locked: zcash.zatToZec(balance.locked_zat),
        availableZat: balance.available_zat,
        lockedZat: balance.locked_zat
      }
    });
  } catch (error) {
    console.error('Error connecting wallet:', error);
    res.status(500).json({ error: 'Failed to connect wallet' });
  }
});

/**
 * GET /api/wallet/:userId/balance
 * Get user balance
 */
router.get('/:userId/balance', (req, res) => {
  try {
    const user = db.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const balance = db.getBalance(user.id);

    res.json({
      balance: {
        available: zcash.zatToZec(balance.available_zat),
        locked: zcash.zatToZec(balance.locked_zat),
        availableZat: balance.available_zat,
        lockedZat: balance.locked_zat
      }
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

/**
 * GET /api/wallet/:userId/positions
 * Get user's market positions
 */
router.get('/:userId/positions', (req, res) => {
  try {
    const positions = db.getUserPositions(req.params.userId);
    
    const formatted = positions.map(p => ({
      marketId: p.market_id,
      marketTitle: p.title,
      category: p.category,
      side: p.side,
      shares: p.shares,
      avgPrice: p.avg_price,
      currentPrice: p.side === 'yes' ? p.yes_price : p.no_price,
      endDate: p.end_date
    }));

    // Calculate total value and P&L
    let totalValue = 0;
    let totalCost = 0;

    formatted.forEach(p => {
      const value = p.shares * p.currentPrice;
      const cost = p.shares * p.avgPrice;
      totalValue += value;
      totalCost += cost;
    });

    res.json({
      positions: formatted,
      summary: {
        totalValue: zcash.zatToZec(totalValue * 100000000),
        totalCost: zcash.zatToZec(totalCost * 100000000),
        pnl: zcash.zatToZec((totalValue - totalCost) * 100000000),
        pnlPercent: totalCost > 0 ? ((totalValue - totalCost) / totalCost * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

/**
 * GET /api/wallet/:userId/trades
 * Get user's trade history
 */
router.get('/:userId/trades', (req, res) => {
  try {
    const trades = db.getUserTrades(req.params.userId);
    
    const formatted = trades.map(t => ({
      id: t.id,
      marketId: t.market_id,
      marketTitle: t.title,
      side: t.side,
      action: t.action,
      shares: t.shares,
      price: t.price,
      amount: zcash.zatToZec(t.amount_zat),
      txHash: t.tx_hash,
      status: t.status,
      createdAt: t.created_at
    }));

    res.json({ trades: formatted });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

/**
 * GET /api/wallet/:userId/transactions
 * Get user's deposit/withdrawal history
 */
router.get('/:userId/transactions', (req, res) => {
  try {
    const transactions = db.getUserTransactions(req.params.userId);
    
    const formatted = transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: zcash.zatToZec(t.amount_zat),
      txHash: t.tx_hash,
      fromAddress: t.from_address,
      toAddress: t.to_address,
      status: t.status,
      createdAt: t.created_at,
      confirmedAt: t.confirmed_at
    }));

    res.json({ transactions: formatted });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

/**
 * POST /api/wallet/:userId/faucet
 * Request testnet ZEC (for testing only)
 */
router.post('/:userId/faucet', async (req, res) => {
  try {
    const { amount = 1.0 } = req.body;
    const userId = req.params.userId;

    const user = db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Limit faucet requests
    if (amount > 10) {
      return res.status(400).json({ error: 'Maximum faucet amount is 10 ZEC' });
    }

    // Credit testnet ZEC
    const result = await zcash.requestTestnetFaucet(userId, amount);
    
    if (result.success) {
      // Add to balance
      db.addToBalance(userId, result.amount_zat);
      
      // Record transaction
      const txId = uuidv4();
      db.createTransaction(
        txId,
        userId,
        'deposit',
        result.amount_zat,
        result.tx_hash,
        'testnet_faucet',
        user.shielded_address
      );
      db.confirmTransaction(txId);

      const balance = db.getBalance(userId);

      res.json({
        success: true,
        credited: result.amount_zec,
        txHash: result.tx_hash,
        newBalance: zcash.zatToZec(balance.available_zat),
        message: result.message
      });
    } else {
      res.status(500).json({ error: 'Faucet request failed' });
    }
  } catch (error) {
    console.error('Error requesting faucet:', error);
    res.status(500).json({ error: 'Failed to request testnet ZEC' });
  }
});

/**
 * POST /api/wallet/:userId/deposit
 * Generate deposit address and instructions
 */
router.post('/:userId/deposit', (req, res) => {
  try {
    const user = db.getUserById(req.params.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      depositAddress: {
        shielded: user.shielded_address,
        transparent: user.transparent_address
      },
      instructions: [
        'Send ZEC to either address above',
        'Shielded address (z-address) recommended for privacy',
        'Deposits are credited after 10 confirmations',
        'Minimum deposit: 0.001 ZEC'
      ],
      network: zcash.network,
      faucetUrl: zcash.network === 'testnet' ? 'https://faucet.testnet.z.cash/' : null
    });
  } catch (error) {
    console.error('Error generating deposit info:', error);
    res.status(500).json({ error: 'Failed to generate deposit info' });
  }
});

export default router;

