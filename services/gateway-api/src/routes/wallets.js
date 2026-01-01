// Gateway API - Wallet Routes
// Privacy: No direct Zcash key access. Settlement via settlement service.

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { query } from '../lib/db.js';

const router = Router();

const zatToZec = (zat) => zat / 100000000;

/**
 * POST /api/wallet/connect
 * Connect a wallet (create or retrieve user)
 * Privacy: User identified by viewing_key_hash, not the key itself
 */
router.post('/connect', async (req, res) => {
  try {
    const { viewingKey } = req.body;
    
    if (!viewingKey) {
      return res.status(400).json({ error: 'Viewing key required' });
    }

    // Hash the viewing key - never store the actual key
    const viewingKeyHash = crypto
      .createHash('sha256')
      .update(viewingKey)
      .digest('hex');

    // Check if user exists
    let result = await query(
      'SELECT * FROM users WHERE viewing_key_hash = $1',
      [viewingKeyHash]
    );

    let user;
    if (result.rows.length > 0) {
      user = result.rows[0];
      // Update last active
      await query(
        'UPDATE users SET last_active_at = NOW() WHERE id = $1',
        [user.id]
      );
    } else {
      // Create new user
      const userId = uuidv4();
      result = await query(
        `INSERT INTO users (id, viewing_key_hash) 
         VALUES ($1, $2) 
         RETURNING *`,
        [userId, viewingKeyHash]
      );
      user = result.rows[0];

      // Initialize balance
      await query(
        'INSERT INTO balances (user_id) VALUES ($1)',
        [userId]
      );
    }

    // Get balance
    const balanceResult = await query(
      'SELECT * FROM balances WHERE user_id = $1',
      [user.id]
    );
    const balance = balanceResult.rows[0] || { available_zat: 0, locked_zat: 0 };

    res.json({
      user: {
        id: user.id,
        createdAt: user.created_at,
      },
      balance: {
        available: zatToZec(parseInt(balance.available_zat)),
        locked: zatToZec(parseInt(balance.locked_zat)),
      },
    });
  } catch (error) {
    console.error('Error connecting wallet:', error);
    res.status(500).json({ error: 'Failed to connect wallet' });
  }
});

/**
 * GET /api/wallet/:id/balance
 * Get user balance
 */
router.get('/:id/balance', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM balances WHERE user_id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const balance = result.rows[0];
    res.json({
      balance: {
        available: zatToZec(parseInt(balance.available_zat)),
        locked: zatToZec(parseInt(balance.locked_zat)),
        pendingDeposit: zatToZec(parseInt(balance.pending_deposit_zat || 0)),
        pendingWithdrawal: zatToZec(parseInt(balance.pending_withdrawal_zat || 0)),
      },
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

/**
 * GET /api/wallet/:id/positions
 * Get user positions
 */
router.get('/:id/positions', async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, m.title, m.yes_price, m.no_price, m.resolved, m.outcome
       FROM positions p
       JOIN markets m ON p.market_id = m.id
       WHERE p.user_id = $1 AND p.shares > 0`,
      [req.params.id]
    );

    const positions = result.rows.map((p) => ({
      id: p.id,
      marketId: p.market_id,
      marketTitle: p.title,
      side: p.side,
      shares: parseInt(p.shares),
      avgPrice: parseFloat(p.avg_price),
      currentPrice: p.side === 'yes' ? parseFloat(p.yes_price) : parseFloat(p.no_price),
      costBasis: zatToZec(parseInt(p.cost_basis_zat)),
      resolved: p.resolved,
      outcome: p.outcome,
    }));

    res.json({ positions });
  } catch (error) {
    console.error('Error fetching positions:', error);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

/**
 * POST /api/wallet/:id/faucet
 * Request testnet ZEC (mock faucet for development)
 * In production, users would deposit real ZEC
 */
router.post('/:id/faucet', async (req, res) => {
  try {
    const userId = req.params.id;
    const amountZec = 10; // 10 testnet ZEC
    const amountZat = amountZec * 100000000;

    // Verify user exists
    const userResult = await query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Credit balance (mock faucet)
    await query(
      `UPDATE balances 
       SET available_zat = available_zat + $1, updated_at = NOW()
       WHERE user_id = $2`,
      [amountZat, userId]
    );

    // Get updated balance
    const balanceResult = await query(
      'SELECT * FROM balances WHERE user_id = $1',
      [userId]
    );
    const balance = balanceResult.rows[0];

    res.json({
      success: true,
      credited: amountZec,
      message: `Credited ${amountZec} testnet ZEC. In production, use https://faucet.testnet.z.cash/`,
      balance: {
        available: zatToZec(parseInt(balance.available_zat)),
      },
    });
  } catch (error) {
    console.error('Error processing faucet:', error);
    res.status(500).json({ error: 'Failed to process faucet request' });
  }
});

export default router;

