import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import amm from '../services/amm.js';
import zcash from '../services/zcash.js';

const router = Router();

/**
 * GET /api/markets
 * Get all active markets
 */
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    
    let markets;
    if (category && category !== 'all') {
      markets = db.getMarketsByCategory(category);
    } else {
      markets = db.getAllMarkets();
    }

    // Convert zatoshi to ZEC for display
    const formatted = markets.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      category: m.category,
      yesPrice: m.yes_price,
      noPrice: m.no_price,
      volume: zcash.zatToZec(m.volume_zat),
      liquidity: zcash.zatToZec(m.liquidity_zat),
      endDate: m.end_date,
      participants: m.participants || 0,
      trending: m.volume_zat > 10000000000 // > 100 ZEC volume
    }));

    res.json({ markets: formatted });
  } catch (error) {
    console.error('Error fetching markets:', error);
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

/**
 * GET /api/markets/:id
 * Get single market details
 */
router.get('/:id', (req, res) => {
  try {
    const market = db.getMarketById(req.params.id);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    const pool = db.getPool(market.id);
    const prices = amm.getPrices(pool.yes_shares, pool.no_shares);

    res.json({
      market: {
        id: market.id,
        title: market.title,
        description: market.description,
        category: market.category,
        yesPrice: prices.yesPrice,
        noPrice: prices.noPrice,
        volume: zcash.zatToZec(market.volume_zat),
        liquidity: zcash.zatToZec(market.liquidity_zat),
        endDate: market.end_date,
        resolved: market.resolved,
        outcome: market.outcome
      },
      pool: {
        yesShares: pool.yes_shares,
        noShares: pool.no_shares
      }
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
router.post('/:id/quote', (req, res) => {
  try {
    const { side, amountZec } = req.body;
    const market = db.getMarketById(req.params.id);
    
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    if (!['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "yes" or "no"' });
    }

    const pool = db.getPool(market.id);
    const amountZat = zcash.zecToZat(amountZec);
    
    const quote = amm.calculateSharesForAmount(
      pool.yes_shares,
      pool.no_shares,
      side,
      amountZat
    );

    const payout = amm.calculatePayout(quote.shares, quote.avgPrice);

    res.json({
      quote: {
        side,
        amountZec,
        amountZat,
        shares: quote.shares,
        avgPrice: quote.avgPrice,
        newYesPrice: quote.yesPrice,
        newNoPrice: quote.noPrice,
        maxPayout: payout.maxPayout,
        potentialProfit: payout.potentialProfit,
        roi: payout.roi
      }
    });
  } catch (error) {
    console.error('Error getting quote:', error);
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
    const marketId = req.params.id;

    // Validate inputs
    if (!userId || !side || !amountZec) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['yes', 'no'].includes(side)) {
      return res.status(400).json({ error: 'Side must be "yes" or "no"' });
    }

    const market = db.getMarketById(marketId);
    if (!market) {
      return res.status(404).json({ error: 'Market not found' });
    }

    if (market.resolved) {
      return res.status(400).json({ error: 'Market is already resolved' });
    }

    // Check user balance
    const balance = db.getBalance(userId);
    const amountZat = zcash.zecToZat(amountZec);

    if (balance.available_zat < amountZat) {
      return res.status(400).json({ 
        error: 'Insufficient balance',
        required: amountZec,
        available: zcash.zatToZec(balance.available_zat)
      });
    }

    // Calculate trade
    const pool = db.getPool(marketId);
    const trade = amm.calculateSharesForAmount(
      pool.yes_shares,
      pool.no_shares,
      side,
      amountZat
    );

    if (trade.shares <= 0) {
      return res.status(400).json({ error: 'Trade amount too small' });
    }

    // Execute trade
    const tradeId = uuidv4();
    const txHash = `zs_${Date.now()}_${tradeId.substring(0, 8)}`;

    // Update pool
    db.updatePool(marketId, trade.newYesShares, trade.newNoShares);

    // Update market prices and volume
    db.updateMarketPrices(marketId, trade.yesPrice, trade.noPrice, amountZat);

    // Deduct from user balance
    db.updateBalance(userId, balance.available_zat - amountZat, balance.locked_zat);

    // Create position
    const positionId = uuidv4();
    db.upsertPosition(positionId, userId, marketId, side, trade.shares, trade.avgPrice);

    // Record trade
    db.createTrade(tradeId, userId, marketId, side, 'buy', trade.shares, trade.avgPrice, amountZat, txHash);
    db.updateTradeStatus(tradeId, 'confirmed');

    res.json({
      success: true,
      trade: {
        id: tradeId,
        txHash,
        side,
        shares: trade.shares,
        avgPrice: trade.avgPrice,
        amountZec,
        newYesPrice: trade.yesPrice,
        newNoPrice: trade.noPrice
      }
    });
  } catch (error) {
    console.error('Error executing trade:', error);
    res.status(500).json({ error: 'Failed to execute trade' });
  }
});

/**
 * GET /api/markets/categories
 * Get all market categories
 */
router.get('/meta/categories', (req, res) => {
  const categories = [
    { id: 'all', name: 'All Markets', icon: 'Grid' },
    { id: 'Economy', name: 'Economy', icon: 'TrendingUp' },
    { id: 'Sports', name: 'Sports', icon: 'Trophy' },
    { id: 'Technology', name: 'Technology', icon: 'Cpu' },
    { id: 'Finance', name: 'Finance', icon: 'Landmark' },
    { id: 'Infrastructure', name: 'Infrastructure', icon: 'Building2' }
  ];
  res.json({ categories });
});

export default router;

