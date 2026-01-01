// Gateway API - Markets Routes
// Proxies to engine service for AMM operations

import { Router } from 'express';
import { query } from '../lib/db.js';
import { engineClient } from '../lib/service-client.js';

const router = Router();

// Convert zatoshi to ZEC
const zatToZec = (zat) => zat / 100000000;
const zecToZat = (zec) => Math.round(zec * 100000000);

/**
 * GET /api/markets
 * Get all active markets
 */
router.get('/', async (req, res) => {
  try {
    const { category, region } = req.query;
    
    let sql = `
      SELECT m.*, lp.yes_shares, lp.no_shares
      FROM markets m
      LEFT JOIN liquidity_pools lp ON m.id = lp.market_id
      WHERE m.resolved = false
    `;
    const params = [];
    
    if (category && category !== 'all') {
      params.push(category);
      sql += ` AND m.category = $${params.length}`;
    }
    
    if (region) {
      params.push(region);
      sql += ` AND m.region = $${params.length}`;
    }
    
    sql += ' ORDER BY m.volume_zat DESC';
    
    const result = await query(sql, params);
    
    const markets = result.rows.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      region: m.region,
      yesPrice: parseFloat(m.yes_price),
      noPrice: parseFloat(m.no_price),
      volume: zatToZec(parseInt(m.volume_zat)),
      liquidity: zatToZec(parseInt(m.liquidity_zat)),
      endDate: m.end_date,
      resolved: m.resolved,
      trending: parseInt(m.volume_zat) > 10000000000,
    }));

    res.json({ markets });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

/**
 * GET /api/markets/:id
 * Get single market details
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await query(
      `SELECT m.*, lp.yes_shares, lp.no_shares, lp.fee_bps
       FROM markets m
       LEFT JOIN liquidity_pools lp ON m.id = lp.market_id
       WHERE m.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const m = result.rows[0];
    res.json({
      market: {
        id: m.id,
        title: m.title,
        description: m.description,
        category: m.category,
        region: m.region,
        yesPrice: parseFloat(m.yes_price),
        noPrice: parseFloat(m.no_price),
        volume: zatToZec(parseInt(m.volume_zat)),
        liquidity: zatToZec(parseInt(m.liquidity_zat)),
        endDate: m.end_date,
        resolved: m.resolved,
        outcome: m.outcome,
        resolutionSource: m.resolution_source,
      },
      pool: {
        yesShares: parseInt(m.yes_shares),
        noShares: parseInt(m.no_shares),
        feeBps: m.fee_bps,
      },
    });
  } catch (error) {
    console.error('Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch market' });
  }
});

/**
 * POST /api/markets/:id/quote
 * Get a price quote for a trade
 */
router.post('/:id/quote', async (req, res) => {
  try {
    const { side, amountZec } = req.body;
    
    if (!['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "yes" or "no"' });
    }
    
    if (!amountZec || amountZec <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Forward to engine service
    const quote = await engineClient.getQuote(
      req.params.id,
      side,
      zecToZat(amountZec)
    );

    res.json({ quote });
  } catch (error) {
    console.error('Error getting quote:', error);
    if (error.status === 404) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

/**
 * POST /api/markets/:id/trade
 * Execute a trade
 */
router.post('/:id/trade', async (req, res) => {
  try {
    const { userId, side, amountZec } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    if (!['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "yes" or "no"' });
    }
    
    if (!amountZec || amountZec <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Forward to engine service
    const result = await engineClient.executeTrade(
      req.params.id,
      userId,
      side,
      zecToZat(amountZec)
    );

    res.json(result);
  } catch (error) {
    console.error('Error executing trade:', error);
    if (error.status === 400) {
      return res.status(400).json({ error: error.data?.error || 'Invalid trade' });
    }
    if (error.status === 404) {
      return res.status(404).json({ error: 'Market not found' });
    }
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

/**
 * GET /api/markets/meta/categories
 * Get all market categories
 */
router.get('/meta/categories', (req, res) => {
  const categories = [
    { id: 'all', name: 'All Markets', icon: 'Grid' },
    { id: 'Africa', name: 'Africa', icon: 'Globe' },
    { id: 'Russia & CIS', name: 'Russia & CIS', icon: 'Globe' },
    { id: 'China', name: 'China', icon: 'Globe' },
    { id: 'Japan', name: 'Japan', icon: 'Globe' },
    { id: 'Southeast Asia', name: 'Southeast Asia', icon: 'Globe' },
    { id: 'Middle East', name: 'Middle East', icon: 'Globe' },
    { id: 'Latin America', name: 'Latin America', icon: 'Globe' },
    { id: 'South Asia', name: 'South Asia', icon: 'Globe' },
  ];
  res.json({ categories });
});

export default router;

