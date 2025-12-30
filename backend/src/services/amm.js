/**
 * Automated Market Maker (AMM) for Prediction Markets
 * Uses Constant Product Market Maker (CPMM) formula
 * 
 * Based on: x * y = k (like Uniswap)
 * Where x = yes_shares, y = no_shares, k = constant
 */

class AMM {
  /**
   * Calculate price after a trade using CPMM
   * @param {number} yesShares - Current yes shares in pool
   * @param {number} noShares - Current no shares in pool
   * @param {string} side - 'yes' or 'no'
   * @param {number} amount - Amount of shares to buy
   * @returns {Object} Trade result with new prices and cost
   */
  calculateTrade(yesShares, noShares, side, amount) {
    const k = yesShares * noShares; // Constant product
    
    let newYesShares, newNoShares, cost;
    
    if (side === 'yes') {
      // Buying YES shares removes them from pool
      newYesShares = yesShares - amount;
      // NO shares must increase to maintain k
      newNoShares = k / newYesShares;
      // Cost is the additional NO shares needed
      cost = newNoShares - noShares;
    } else {
      // Buying NO shares removes them from pool
      newNoShares = noShares - amount;
      // YES shares must increase to maintain k
      newYesShares = k / newNoShares;
      // Cost is the additional YES shares needed
      cost = newYesShares - yesShares;
    }

    // Calculate new prices
    const totalShares = newYesShares + newNoShares;
    const newYesPrice = newNoShares / totalShares;
    const newNoPrice = newYesShares / totalShares;

    return {
      newYesShares: Math.round(newYesShares),
      newNoShares: Math.round(newNoShares),
      yesPrice: newYesPrice,
      noPrice: newNoPrice,
      cost: Math.ceil(cost), // Cost in the opposite outcome shares
      pricePerShare: cost / amount
    };
  }

  /**
   * Calculate how many shares you get for a given ZEC amount
   * @param {number} yesShares - Current yes shares in pool
   * @param {number} noShares - Current no shares in pool
   * @param {string} side - 'yes' or 'no'
   * @param {number} amountZat - Amount in zatoshi to spend
   * @returns {Object} Shares received and new state
   */
  calculateSharesForAmount(yesShares, noShares, side, amountZat) {
    const k = yesShares * noShares;
    const totalShares = yesShares + noShares;
    
    // Current price
    const currentPrice = side === 'yes' 
      ? noShares / totalShares 
      : yesShares / totalShares;
    
    // Estimate shares (will be adjusted by slippage)
    // Using quadratic formula derived from CPMM
    let shares;
    
    if (side === 'yes') {
      // Adding amountZat worth of liquidity to NO side
      // New NO shares = noShares + amountZat (normalized)
      const normalizedAmount = amountZat / 100000; // Scale factor
      const newNoShares = noShares + normalizedAmount;
      const newYesShares = k / newNoShares;
      shares = yesShares - newYesShares;
    } else {
      const normalizedAmount = amountZat / 100000;
      const newYesShares = yesShares + normalizedAmount;
      const newNoShares = k / newYesShares;
      shares = noShares - newNoShares;
    }

    shares = Math.max(0, Math.floor(shares));
    
    // Recalculate with actual shares
    const result = this.calculateTrade(yesShares, noShares, side, shares);
    
    return {
      shares,
      avgPrice: shares > 0 ? amountZat / shares / 100000000 : 0,
      ...result
    };
  }

  /**
   * Calculate the cost in ZAT to buy a specific number of shares
   * @param {number} yesShares - Current yes shares in pool
   * @param {number} noShares - Current no shares in pool
   * @param {string} side - 'yes' or 'no'
   * @param {number} sharesToBuy - Number of shares to buy
   * @returns {Object} Cost and new state
   */
  calculateCostForShares(yesShares, noShares, side, sharesToBuy) {
    const result = this.calculateTrade(yesShares, noShares, side, sharesToBuy);
    
    // Convert cost (in shares) to ZAT
    // 1 share at price 1.0 = 1 ZEC = 100000000 ZAT
    const costZat = Math.ceil(result.cost * 100000000);
    
    return {
      costZat,
      costZec: costZat / 100000000,
      pricePerShare: result.pricePerShare,
      ...result
    };
  }

  /**
   * Get current market prices from pool state
   * @param {number} yesShares - Current yes shares in pool
   * @param {number} noShares - Current no shares in pool
   * @returns {Object} Current prices
   */
  getPrices(yesShares, noShares) {
    const total = yesShares + noShares;
    return {
      yesPrice: noShares / total,
      noPrice: yesShares / total
    };
  }

  /**
   * Calculate implied probability from price
   * @param {number} price - Current price (0-1)
   * @returns {number} Probability percentage
   */
  priceToProb(price) {
    return Math.round(price * 100);
  }

  /**
   * Calculate potential payout
   * @param {number} shares - Number of shares
   * @param {number} avgPrice - Average purchase price
   * @returns {Object} Payout details
   */
  calculatePayout(shares, avgPrice) {
    const cost = shares * avgPrice;
    const maxPayout = shares; // Each share pays 1 ZEC if correct
    const potentialProfit = maxPayout - cost;
    const roi = cost > 0 ? (potentialProfit / cost) * 100 : 0;

    return {
      cost,
      maxPayout,
      potentialProfit,
      roi: Math.round(roi)
    };
  }

  /**
   * Initialize a new market pool
   * @param {number} initialLiquidity - Initial liquidity in ZAT
   * @returns {Object} Initial pool state
   */
  initializePool(initialLiquidity = 1000000) {
    // Start with equal shares for 50/50 odds
    return {
      yesShares: initialLiquidity,
      noShares: initialLiquidity,
      constantProduct: initialLiquidity * initialLiquidity
    };
  }
}

export default new AMM();

