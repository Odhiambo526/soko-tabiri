// Engine Service - Trade Routes

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, getPool } from '../lib/db.js';
import { calculateSharesForAmount } from '../amm/index.js';
import { tradeCounter, tradeVolumeHistogram } from '../index.js';

const router = Router();

/**
 * POST /api/trade
 * Execute a trade
 */
router.post('/', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    const { marketId, userId, side, amountZat } = req.body;
    
    // Validate inputs
    if (!marketId || !userId || !side || !amountZat) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "yes" or "no"' });
    }

    await client.query('BEGIN');

    // Get market and pool with lock
    const marketResult = await client.query(
      `SELECT m.*, lp.yes_shares, lp.no_shares, lp.fee_bps
       FROM markets m
       JOIN liquidity_pools lp ON m.id = lp.market_id
       WHERE m.id = $1
       FOR UPDATE OF lp`,
      [marketId]
    );

    if (marketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = marketResult.rows[0];
    
    if (market.resolved) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Market is resolved' });
    }

    // Check user balance
    const balanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1 FOR UPDATE',
      [userId]
    );

    if (balanceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    const balance = balanceResult.rows[0];
    if (BigInt(balance.available_zat) < BigInt(amountZat)) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Insufficient balance',
        required: amountZat,
        available: balance.available_zat,
      });
    }

    // Calculate trade
    const trade = calculateSharesForAmount(
      market.yes_shares,
      market.no_shares,
      side,
      BigInt(amountZat),
      market.fee_bps || 30
    );

    if (trade.shares <= 0n) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Trade amount too small' });
    }

    // Update pool
    await client.query(
      `UPDATE liquidity_pools 
       SET yes_shares = $1, no_shares = $2, updated_at = NOW()
       WHERE market_id = $3`,
      [trade.newYesShares.toString(), trade.newNoShares.toString(), marketId]
    );

    // Update market prices and volume
    await client.query(
      `UPDATE markets 
       SET yes_price = $1, no_price = $2, volume_zat = volume_zat + $3
       WHERE id = $4`,
      [trade.yesPrice, trade.noPrice, amountZat, marketId]
    );

    // Deduct from user balance
    await client.query(
      `UPDATE balances 
       SET available_zat = available_zat - $1, updated_at = NOW()
       WHERE user_id = $2`,
      [amountZat, userId]
    );

    // Create or update position
    const positionResult = await client.query(
      `INSERT INTO positions (id, user_id, market_id, side, shares, avg_price, cost_basis_zat)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, market_id, side) 
       DO UPDATE SET 
         shares = positions.shares + EXCLUDED.shares,
         avg_price = (positions.cost_basis_zat + EXCLUDED.cost_basis_zat) / 
                     (positions.shares + EXCLUDED.shares) / 100000000.0,
         cost_basis_zat = positions.cost_basis_zat + EXCLUDED.cost_basis_zat,
         updated_at = NOW()
       RETURNING *`,
      [uuidv4(), userId, marketId, side, trade.shares.toString(), trade.avgPrice, amountZat]
    );

    // Create fill record
    const fillId = uuidv4();
    await client.query(
      `INSERT INTO fills (id, user_id, market_id, side, direction, price, quantity, amount_zat, fee_zat, source)
       VALUES ($1, $2, $3, $4, 'buy', $5, $6, $7, $8, 'amm')`,
      [fillId, userId, marketId, side, trade.avgPrice, trade.shares.toString(), amountZat, trade.fee.toString()]
    );

    // Create settlement job
    const settlementJobId = uuidv4();
    await client.query(
      `INSERT INTO settlement_jobs (id, job_type, fill_id, market_id, user_id, amount_zat, tx_type, status)
       VALUES ($1, 'trade_settlement', $2, $3, $4, $5, 'shielded', 'pending')`,
      [settlementJobId, fillId, marketId, userId, amountZat]
    );

    await client.query('COMMIT');

    // Update metrics
    tradeCounter.inc({ market: marketId, side, source: 'amm' });
    tradeVolumeHistogram.observe({ market: marketId }, parseInt(amountZat));

    res.json({
      success: true,
      trade: {
        fillId,
        settlementJobId,
        side,
        shares: trade.shares.toString(),
        avgPrice: trade.avgPrice,
        amountZat: parseInt(amountZat),
        fee: trade.fee.toString(),
        newYesPrice: trade.yesPrice,
        newNoPrice: trade.noPrice,
      },
      position: positionResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error executing trade:', error);
    if (error.message === 'Insufficient liquidity') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to execute trade' });
  } finally {
    client.release();
  }
});

export default router;

