// Soko Tabiri - AMM Unit Tests
// Tests for Constant Product Market Maker invariants

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  calculateTrade,
  calculateSharesForAmount,
  getPrices,
  calculatePayout,
  initializePool,
} from '../src/amm/index.js';

describe('AMM - Constant Product Market Maker', () => {
  describe('initializePool', () => {
    it('should initialize pool with equal shares', () => {
      const pool = initializePool(1000000n);
      
      assert.strictEqual(pool.yesShares, 1000000n);
      assert.strictEqual(pool.noShares, 1000000n);
      assert.strictEqual(pool.constantProduct, 1000000000000n);
    });

    it('should initialize with 50/50 prices', () => {
      const pool = initializePool(1000000n);
      const prices = getPrices(pool.yesShares, pool.noShares);
      
      assert.strictEqual(prices.yesPrice, 0.5);
      assert.strictEqual(prices.noPrice, 0.5);
    });
  });

  describe('calculateTrade - Invariant Tests', () => {
    it('should maintain k invariant after YES trade (within tolerance)', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      const k = yesShares * noShares;
      
      const result = calculateTrade(yesShares, noShares, 'yes', 10000n, 0);
      const newK = result.newYesShares * result.newNoShares;
      
      // k should be maintained or slightly increased due to rounding
      assert.ok(newK >= k, `k decreased: ${newK} < ${k}`);
      
      // Check tolerance (0.01%)
      const tolerance = k / 10000n;
      assert.ok(newK - k <= tolerance, `k increased too much: ${newK - k} > ${tolerance}`);
    });

    it('should maintain k invariant after NO trade (within tolerance)', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      const k = yesShares * noShares;
      
      const result = calculateTrade(yesShares, noShares, 'no', 10000n, 0);
      const newK = result.newYesShares * result.newNoShares;
      
      assert.ok(newK >= k, `k decreased: ${newK} < ${k}`);
      
      const tolerance = k / 10000n;
      assert.ok(newK - k <= tolerance, `k increased too much: ${newK - k} > ${tolerance}`);
    });

    it('should maintain k invariant after multiple trades', () => {
      let yesShares = 1000000n;
      let noShares = 1000000n;
      const initialK = yesShares * noShares;
      
      // Execute multiple trades
      const trades = [
        { side: 'yes', amount: 5000n },
        { side: 'no', amount: 3000n },
        { side: 'yes', amount: 8000n },
        { side: 'no', amount: 2000n },
      ];

      for (const trade of trades) {
        const result = calculateTrade(yesShares, noShares, trade.side, trade.amount, 0);
        yesShares = result.newYesShares;
        noShares = result.newNoShares;
      }

      const finalK = yesShares * noShares;
      
      // k should not decrease
      assert.ok(finalK >= initialK, `k decreased after multiple trades`);
      
      // k should not increase by more than 1%
      const maxIncrease = initialK / 100n;
      assert.ok(finalK - initialK <= maxIncrease, `k increased too much after multiple trades`);
    });

    it('should throw on insufficient liquidity', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      
      assert.throws(() => {
        calculateTrade(yesShares, noShares, 'yes', 1000001n, 0);
      }, /Insufficient liquidity/);
    });
  });

  describe('calculateTrade - Price Impact', () => {
    it('should increase YES price when buying YES', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      
      const beforePrices = getPrices(yesShares, noShares);
      const result = calculateTrade(yesShares, noShares, 'yes', 50000n, 0);
      
      assert.ok(result.yesPrice > beforePrices.yesPrice, 'YES price should increase');
      assert.ok(result.noPrice < beforePrices.noPrice, 'NO price should decrease');
    });

    it('should increase NO price when buying NO', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      
      const beforePrices = getPrices(yesShares, noShares);
      const result = calculateTrade(yesShares, noShares, 'no', 50000n, 0);
      
      assert.ok(result.noPrice > beforePrices.noPrice, 'NO price should increase');
      assert.ok(result.yesPrice < beforePrices.yesPrice, 'YES price should decrease');
    });

    it('should have larger price impact for larger trades', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      
      const smallTrade = calculateTrade(yesShares, noShares, 'yes', 10000n, 0);
      const largeTrade = calculateTrade(yesShares, noShares, 'yes', 100000n, 0);
      
      const smallImpact = smallTrade.yesPrice - 0.5;
      const largeImpact = largeTrade.yesPrice - 0.5;
      
      assert.ok(largeImpact > smallImpact, 'Larger trade should have larger price impact');
    });
  });

  describe('calculateTrade - Fees', () => {
    it('should apply fee to trade cost', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      
      const noFee = calculateTrade(yesShares, noShares, 'yes', 10000n, 0);
      const withFee = calculateTrade(yesShares, noShares, 'yes', 10000n, 30); // 0.3% fee
      
      assert.ok(withFee.totalCost > noFee.totalCost, 'Fee should increase total cost');
      assert.ok(withFee.fee > 0n, 'Fee should be positive');
    });

    it('should calculate correct fee amount', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      
      const result = calculateTrade(yesShares, noShares, 'yes', 10000n, 100); // 1% fee
      
      // Fee should be approximately 1% of cost
      const expectedFee = result.costInShares / 100n;
      const tolerance = expectedFee / 10n; // 10% tolerance for rounding
      
      assert.ok(
        result.fee >= expectedFee - tolerance && result.fee <= expectedFee + tolerance,
        `Fee ${result.fee} should be approximately ${expectedFee}`
      );
    });
  });

  describe('calculateSharesForAmount', () => {
    it('should return positive shares for valid amount', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      const amountZat = 100000000n; // 1 ZEC
      
      const result = calculateSharesForAmount(yesShares, noShares, 'yes', amountZat, 0);
      
      assert.ok(result.shares > 0n, 'Should return positive shares');
    });

    it('should maintain invariant after amount-based trade', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      const k = yesShares * noShares;
      const amountZat = 100000000n;
      
      const result = calculateSharesForAmount(yesShares, noShares, 'yes', amountZat, 0);
      const newK = result.newYesShares * result.newNoShares;
      
      // k should be maintained
      const tolerance = k / 1000n;
      assert.ok(
        newK >= k - tolerance && newK <= k + tolerance,
        `k changed too much: ${newK} vs ${k}`
      );
    });

    it('should throw for amount too small', () => {
      const yesShares = 1000000n;
      const noShares = 1000000n;
      
      assert.throws(() => {
        calculateSharesForAmount(yesShares, noShares, 'yes', 1n, 0);
      }, /Trade amount too small/);
    });
  });

  describe('getPrices', () => {
    it('should return prices that sum to 1', () => {
      const testCases = [
        { yes: 1000000n, no: 1000000n },
        { yes: 800000n, no: 1200000n },
        { yes: 1500000n, no: 500000n },
      ];

      for (const tc of testCases) {
        const prices = getPrices(tc.yes, tc.no);
        const sum = prices.yesPrice + prices.noPrice;
        
        // Allow small floating point error
        assert.ok(
          Math.abs(sum - 1) < 0.0001,
          `Prices should sum to 1, got ${sum}`
        );
      }
    });

    it('should reflect pool imbalance', () => {
      // More YES shares = lower YES price (more supply)
      const prices = getPrices(1500000n, 500000n);
      
      assert.ok(prices.yesPrice < 0.5, 'YES price should be < 0.5 when more YES shares');
      assert.ok(prices.noPrice > 0.5, 'NO price should be > 0.5 when fewer NO shares');
    });
  });

  describe('calculatePayout', () => {
    it('should calculate correct ROI', () => {
      const shares = 100n;
      const avgPrice = 0.4;
      
      const payout = calculatePayout(shares, avgPrice);
      
      assert.strictEqual(payout.cost, 40);
      assert.strictEqual(payout.maxPayout, 100);
      assert.strictEqual(payout.potentialProfit, 60);
      assert.strictEqual(payout.roi, 150); // 60/40 * 100 = 150%
    });

    it('should handle edge case of price = 1', () => {
      const shares = 100n;
      const avgPrice = 1.0;
      
      const payout = calculatePayout(shares, avgPrice);
      
      assert.strictEqual(payout.cost, 100);
      assert.strictEqual(payout.maxPayout, 100);
      assert.strictEqual(payout.potentialProfit, 0);
      assert.strictEqual(payout.roi, 0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large trades', () => {
      const yesShares = 1000000000000n; // 1 trillion
      const noShares = 1000000000000n;
      
      // Should not throw
      const result = calculateTrade(yesShares, noShares, 'yes', 100000000n, 30);
      
      assert.ok(result.newYesShares < yesShares);
      assert.ok(result.newNoShares > noShares);
    });

    it('should handle imbalanced pools', () => {
      const yesShares = 100000n;
      const noShares = 10000000n; // 100x imbalance
      
      const result = calculateTrade(yesShares, noShares, 'yes', 1000n, 0);
      
      // YES price should be very high (scarce)
      assert.ok(result.yesPrice > 0.9, 'YES price should be high in imbalanced pool');
    });
  });
});

