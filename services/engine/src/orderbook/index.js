/**
 * Soko Tabiri - Off-Chain Limit Orderbook
 * Simple orderbook matching engine that writes matches to settlement_jobs
 * 
 * Privacy: This module performs matching logic. No Zcash key access.
 * 
 * Note: AMM is the primary trading mechanism. Orderbook is optional for
 * users who want to place limit orders at specific prices.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * In-memory orderbook structure
 * In production, this would be backed by Redis for persistence
 */
const orderbooks = new Map(); // marketId -> { bids: [], asks: [] }

/**
 * Order structure
 * @typedef {Object} Order
 * @property {string} id - Order ID
 * @property {string} userId - User ID
 * @property {string} marketId - Market ID
 * @property {string} side - 'yes' or 'no'
 * @property {string} direction - 'buy' or 'sell'
 * @property {number} price - Limit price (0.01 to 0.99)
 * @property {bigint} quantity - Number of shares
 * @property {bigint} filledQuantity - Filled quantity
 * @property {string} status - 'open', 'partial', 'filled', 'cancelled'
 * @property {Date} createdAt - Creation timestamp
 */

/**
 * Get or create orderbook for a market
 * @param {string} marketId 
 * @returns {Object} Orderbook with bids and asks
 */
function getOrderbook(marketId) {
  if (!orderbooks.has(marketId)) {
    orderbooks.set(marketId, {
      bids: [], // Buy orders, sorted by price descending
      asks: [], // Sell orders, sorted by price ascending
    });
  }
  return orderbooks.get(marketId);
}

/**
 * Add an order to the orderbook
 * @param {Order} order 
 * @returns {Object} Result with order and any immediate matches
 */
export function addOrder(order) {
  const book = getOrderbook(order.marketId);
  const matches = [];
  let remainingQuantity = order.quantity;

  // Try to match against existing orders
  if (order.direction === 'buy') {
    // Match against asks (sell orders)
    const matchableAsks = book.asks.filter(
      (ask) => ask.price <= order.price && ask.side === order.side
    );

    for (const ask of matchableAsks) {
      if (remainingQuantity <= 0n) break;

      const askRemaining = ask.quantity - ask.filledQuantity;
      const fillQuantity = remainingQuantity < askRemaining ? remainingQuantity : askRemaining;
      const fillPrice = ask.price; // Price improvement for buyer

      // Create match
      matches.push({
        id: uuidv4(),
        buyOrderId: order.id,
        sellOrderId: ask.id,
        price: fillPrice,
        quantity: fillQuantity,
        buyerId: order.userId,
        sellerId: ask.userId,
        marketId: order.marketId,
        side: order.side,
      });

      // Update quantities
      remainingQuantity -= fillQuantity;
      ask.filledQuantity += fillQuantity;

      // Update ask status
      if (ask.filledQuantity >= ask.quantity) {
        ask.status = 'filled';
      } else {
        ask.status = 'partial';
      }
    }

    // Remove filled asks
    book.asks = book.asks.filter((ask) => ask.status !== 'filled');
  } else {
    // Match against bids (buy orders)
    const matchableBids = book.bids.filter(
      (bid) => bid.price >= order.price && bid.side === order.side
    );

    for (const bid of matchableBids) {
      if (remainingQuantity <= 0n) break;

      const bidRemaining = bid.quantity - bid.filledQuantity;
      const fillQuantity = remainingQuantity < bidRemaining ? remainingQuantity : bidRemaining;
      const fillPrice = bid.price; // Price improvement for seller

      // Create match
      matches.push({
        id: uuidv4(),
        buyOrderId: bid.id,
        sellOrderId: order.id,
        price: fillPrice,
        quantity: fillQuantity,
        buyerId: bid.userId,
        sellerId: order.userId,
        marketId: order.marketId,
        side: order.side,
      });

      // Update quantities
      remainingQuantity -= fillQuantity;
      bid.filledQuantity += fillQuantity;

      // Update bid status
      if (bid.filledQuantity >= bid.quantity) {
        bid.status = 'filled';
      } else {
        bid.status = 'partial';
      }
    }

    // Remove filled bids
    book.bids = book.bids.filter((bid) => bid.status !== 'filled');
  }

  // Update order with filled quantity
  order.filledQuantity = order.quantity - remainingQuantity;

  // Determine order status
  if (order.filledQuantity >= order.quantity) {
    order.status = 'filled';
  } else if (order.filledQuantity > 0n) {
    order.status = 'partial';
    // Add remaining to book
    addToBook(book, order);
  } else {
    order.status = 'open';
    addToBook(book, order);
  }

  return {
    order,
    matches,
  };
}

/**
 * Add order to the appropriate side of the book
 * @param {Object} book 
 * @param {Order} order 
 */
function addToBook(book, order) {
  if (order.direction === 'buy') {
    book.bids.push(order);
    // Sort bids by price descending (best bid first)
    book.bids.sort((a, b) => b.price - a.price);
  } else {
    book.asks.push(order);
    // Sort asks by price ascending (best ask first)
    book.asks.sort((a, b) => a.price - b.price);
  }
}

/**
 * Cancel an order
 * @param {string} marketId 
 * @param {string} orderId 
 * @returns {Order|null} Cancelled order or null if not found
 */
export function cancelOrder(marketId, orderId) {
  const book = getOrderbook(marketId);
  
  // Check bids
  const bidIndex = book.bids.findIndex((o) => o.id === orderId);
  if (bidIndex !== -1) {
    const order = book.bids.splice(bidIndex, 1)[0];
    order.status = 'cancelled';
    return order;
  }

  // Check asks
  const askIndex = book.asks.findIndex((o) => o.id === orderId);
  if (askIndex !== -1) {
    const order = book.asks.splice(askIndex, 1)[0];
    order.status = 'cancelled';
    return order;
  }

  return null;
}

/**
 * Get current orderbook state
 * @param {string} marketId 
 * @param {number} depth - Number of levels to return
 * @returns {Object} Orderbook snapshot
 */
export function getOrderbookSnapshot(marketId, depth = 10) {
  const book = getOrderbook(marketId);
  
  // Aggregate by price level
  const aggregateLevels = (orders) => {
    const levels = new Map();
    for (const order of orders) {
      const remaining = order.quantity - order.filledQuantity;
      if (remaining > 0n) {
        const current = levels.get(order.price) || 0n;
        levels.set(order.price, current + remaining);
      }
    }
    return Array.from(levels.entries())
      .map(([price, quantity]) => ({ price, quantity }))
      .slice(0, depth);
  };

  return {
    marketId,
    bids: aggregateLevels(book.bids),
    asks: aggregateLevels(book.asks),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get best bid and ask
 * @param {string} marketId 
 * @returns {Object} Best bid/ask prices
 */
export function getBestPrices(marketId) {
  const book = getOrderbook(marketId);
  
  const bestBid = book.bids.length > 0 ? book.bids[0].price : null;
  const bestAsk = book.asks.length > 0 ? book.asks[0].price : null;
  const spread = bestBid && bestAsk ? bestAsk - bestBid : null;

  return {
    bestBid,
    bestAsk,
    spread,
    midPrice: bestBid && bestAsk ? (bestBid + bestAsk) / 2 : null,
  };
}

/**
 * Clear orderbook for a market (e.g., when market resolves)
 * @param {string} marketId 
 */
export function clearOrderbook(marketId) {
  orderbooks.delete(marketId);
}

/**
 * Create a new order object
 * @param {Object} params 
 * @returns {Order}
 */
export function createOrder(params) {
  return {
    id: params.id || uuidv4(),
    userId: params.userId,
    marketId: params.marketId,
    side: params.side, // 'yes' or 'no'
    direction: params.direction, // 'buy' or 'sell'
    price: params.price,
    quantity: BigInt(params.quantity),
    filledQuantity: 0n,
    status: 'open',
    createdAt: new Date(),
  };
}

export default {
  addOrder,
  cancelOrder,
  getOrderbookSnapshot,
  getBestPrices,
  clearOrderbook,
  createOrder,
};

