/**
 * Soko Tabiri - Automated Market Maker (AMM)
 * Uses Constant Product Market Maker (CPMM) formula: x * y = k
 * 
 * Privacy: This module performs pure math. No Zcash key access.
 * 
 * Invariant: After any trade, x_new * y_new = k (within rounding tolerance)
 */

/**
 * Calculate trade result using CPMM
 * @param {bigint} yesShares - Current yes shares in pool
 * @param {bigint} noShares - Current no shares in pool
 * @param {string} side - 'yes' or 'no'
 * @param {bigint} sharesToBuy - Number of shares to buy
 * @param {number} feeBps - Fee in basis points (100 = 1%)
 * @returns {Object} Trade result
 */
export function calculateTrade(yesShares, noShares, side, sharesToBuy, feeBps = 30) {
  // Ensure we're working with BigInt
  yesShares = BigInt(yesShares);
  noShares = BigInt(noShares);
  sharesToBuy = BigInt(sharesToBuy);
  
  const k = yesShares * noShares;
  
  let newYesShares, newNoShares, costInOppositeShares;
  
  if (side === 'yes') {
    // Buying YES shares removes them from pool
    newYesShares = yesShares - sharesToBuy;
    if (newYesShares <= 0n) {
      throw new Error('Insufficient liquidity');
    }
    // NO shares must increase to maintain k
    newNoShares = k / newYesShares;
    if (k % newYesShares !== 0n) {
      newNoShares += 1n; // Round up
    }
    costInOppositeShares = newNoShares - noShares;
  } else {
    // Buying NO shares removes them from pool
    newNoShares = noShares - sharesToBuy;
    if (newNoShares <= 0n) {
      throw new Error('Insufficient liquidity');
    }
    // YES shares must increase to maintain k
    newYesShares = k / newNoShares;
    if (k % newNoShares !== 0n) {
      newYesShares += 1n; // Round up
    }
    costInOppositeShares = newYesShares - yesShares;
  }

  // Apply fee
  const fee = (costInOppositeShares * BigInt(feeBps)) / 10000n;
  const totalCost = costInOppositeShares + fee;

  // Calculate new prices
  const totalShares = newYesShares + newNoShares;
  const yesPrice = Number(newNoShares) / Number(totalShares);
  const noPrice = Number(newYesShares) / Number(totalShares);

  // Verify invariant: k should never decrease (rounding up may increase it slightly)
  // This is expected behavior - we round up to prevent liquidity loss
  const newK = newYesShares * newNoShares;
  if (newK < k) {
    throw new Error('AMM invariant violation: k decreased');
  }
  // Allow k to increase slightly due to rounding (tested separately with reasonable tolerance)

  return {
    newYesShares,
    newNoShares,
    yesPrice,
    noPrice,
    costInShares: costInOppositeShares,
    fee,
    totalCost,
    pricePerShare: Number(totalCost) / Number(sharesToBuy),
  };
}

/**
 * Calculate shares received for a given amount (in zatoshi)
 * @param {bigint} yesShares - Current yes shares in pool
 * @param {bigint} noShares - Current no shares in pool
 * @param {string} side - 'yes' or 'no'
 * @param {bigint} amountZat - Amount in zatoshi to spend
 * @param {number} feeBps - Fee in basis points
 * @returns {Object} Shares received and new state
 */
export function calculateSharesForAmount(yesShares, noShares, side, amountZat, feeBps = 30) {
  yesShares = BigInt(yesShares);
  noShares = BigInt(noShares);
  amountZat = BigInt(amountZat);
  
  const k = yesShares * noShares;
  
  // Scale factor: 1 share at price 1.0 = 1 ZEC = 100,000,000 zatoshi
  const SCALE = 100000n;
  const normalizedAmount = amountZat / SCALE;
  
  // Apply fee to input
  const feeAmount = (normalizedAmount * BigInt(feeBps)) / 10000n;
  const amountAfterFee = normalizedAmount - feeAmount;
  
  let shares;
  let newYesShares, newNoShares;
  
  if (side === 'yes') {
    // Adding to NO side, removing from YES side
    newNoShares = noShares + amountAfterFee;
    newYesShares = k / newNoShares;
    shares = yesShares - newYesShares;
  } else {
    // Adding to YES side, removing from NO side
    newYesShares = yesShares + amountAfterFee;
    newNoShares = k / newYesShares;
    shares = noShares - newNoShares;
  }
  
  if (shares <= 0n) {
    throw new Error('Trade amount too small');
  }

  // Calculate prices
  const totalShares = newYesShares + newNoShares;
  const yesPrice = Number(newNoShares) / Number(totalShares);
  const noPrice = Number(newYesShares) / Number(totalShares);

  return {
    shares,
    newYesShares,
    newNoShares,
    yesPrice,
    noPrice,
    avgPrice: Number(amountZat) / Number(shares) / 100000000,
    fee: feeAmount * SCALE,
  };
}

/**
 * Get current market prices from pool state
 * @param {bigint} yesShares - Current yes shares in pool
 * @param {bigint} noShares - Current no shares in pool
 * @returns {Object} Current prices
 */
export function getPrices(yesShares, noShares) {
  yesShares = BigInt(yesShares);
  noShares = BigInt(noShares);
  const total = yesShares + noShares;
  return {
    yesPrice: Number(noShares) / Number(total),
    noPrice: Number(yesShares) / Number(total),
  };
}

/**
 * Calculate potential payout
 * @param {bigint} shares - Number of shares
 * @param {number} avgPrice - Average purchase price
 * @returns {Object} Payout details
 */
export function calculatePayout(shares, avgPrice) {
  shares = BigInt(shares);
  const cost = Number(shares) * avgPrice;
  const maxPayout = Number(shares); // Each share pays 1 ZEC if correct
  const potentialProfit = maxPayout - cost;
  const roi = cost > 0 ? (potentialProfit / cost) * 100 : 0;

  return {
    cost,
    maxPayout,
    potentialProfit,
    roi: Math.round(roi),
  };
}

/**
 * Initialize a new market pool
 * @param {bigint} initialLiquidity - Initial liquidity per side
 * @returns {Object} Initial pool state
 */
export function initializePool(initialLiquidity = 1000000n) {
  initialLiquidity = BigInt(initialLiquidity);
  return {
    yesShares: initialLiquidity,
    noShares: initialLiquidity,
    constantProduct: initialLiquidity * initialLiquidity,
  };
}

export default {
  calculateTrade,
  calculateSharesForAmount,
  getPrices,
  calculatePayout,
  initializePool,
};

