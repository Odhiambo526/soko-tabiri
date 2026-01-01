// Engine Service - Quote Routes

import { Router } from 'express';
import { query } from '../lib/db.js';
import { calculateSharesForAmount, getPrices, calculatePayout } from '../amm/index.js';

const router = Router();

/**
 * POST /api/quote
 * Get a price quote for a trade
 */
router.post('/', async (req, res) => {
  try {
    const { marketId, side, amountZat } = req.body;
    
    if (!marketId) {
      return res.status(400).json({ error: 'Market ID required' });
    }
    
    if (!['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "yes" or "no"' });
    }
    
    if (!amountZat || amountZat <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get market and pool
    const result = await query(
      `SELECT m.*, lp.yes_shares, lp.no_shares, lp.fee_bps
       FROM markets m
       JOIN liquidity_pools lp ON m.id = lp.market_id
       WHERE m.id = $1`,
      [marketId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const market = result.rows[0];
    
    if (market.resolved) {
      return res.status(400).json({ error: 'Market is resolved' });
    }

    // Calculate quote
    const quote = calculateSharesForAmount(
      market.yes_shares,
      market.no_shares,
      side,
      BigInt(amountZat),
      market.fee_bps || 30
    );

    const payout = calculatePayout(quote.shares, quote.avgPrice);

    res.json({
      quote: {
        marketId,
        side,
        amountZat: parseInt(amountZat),
        shares: quote.shares.toString(),
        avgPrice: quote.avgPrice,
        newYesPrice: quote.yesPrice,
        newNoPrice: quote.noPrice,
        fee: quote.fee.toString(),
        maxPayout: payout.maxPayout,
        potentialProfit: payout.potentialProfit,
        roi: payout.roi,
      },
    });
  } catch (error) {
    console.error('Error getting quote:', error);
    if (error.message === 'Trade amount too small' || error.message === 'Insufficient liquidity') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

export default router;

