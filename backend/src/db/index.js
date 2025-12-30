import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { schema, seedMarkets, seedLiquidityPools } from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class DB {
  constructor() {
    this.db = null;
  }

  init(dbPath) {
    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    // Run schema
    this.db.exec(schema);
    
    // Seed initial markets
    this.db.exec(seedMarkets);
    this.db.exec(seedLiquidityPools);
    
    console.log('✅ Database initialized');
    return this;
  }

  // User operations
  createUser(id, viewingKey, transparentAddr, shieldedAddr) {
    const stmt = this.db.prepare(`
      INSERT INTO users (id, viewing_key, transparent_address, shielded_address)
      VALUES (?, ?, ?, ?)
    `);
    return stmt.run(id, viewingKey, transparentAddr, shieldedAddr);
  }

  getUserByViewingKey(viewingKey) {
    return this.db.prepare('SELECT * FROM users WHERE viewing_key = ?').get(viewingKey);
  }

  getUserById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  // Balance operations
  getBalance(userId) {
    let balance = this.db.prepare('SELECT * FROM balances WHERE user_id = ?').get(userId);
    if (!balance) {
      this.db.prepare('INSERT INTO balances (user_id, available_zat, locked_zat) VALUES (?, 0, 0)').run(userId);
      balance = { user_id: userId, available_zat: 0, locked_zat: 0 };
    }
    return balance;
  }

  updateBalance(userId, availableZat, lockedZat) {
    const stmt = this.db.prepare(`
      INSERT INTO balances (user_id, available_zat, locked_zat, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id) DO UPDATE SET
        available_zat = excluded.available_zat,
        locked_zat = excluded.locked_zat,
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(userId, availableZat, lockedZat);
  }

  addToBalance(userId, amountZat) {
    const balance = this.getBalance(userId);
    return this.updateBalance(userId, balance.available_zat + amountZat, balance.locked_zat);
  }

  // Market operations
  getAllMarkets() {
    return this.db.prepare(`
      SELECT m.*, 
        (SELECT COUNT(DISTINCT user_id) FROM positions WHERE market_id = m.id) as participants
      FROM markets m 
      WHERE m.resolved = FALSE 
      ORDER BY m.volume_zat DESC
    `).all();
  }

  getMarketById(id) {
    return this.db.prepare('SELECT * FROM markets WHERE id = ?').get(id);
  }

  getMarketsByCategory(category) {
    return this.db.prepare('SELECT * FROM markets WHERE category = ? AND resolved = FALSE').all(category);
  }

  updateMarketPrices(marketId, yesPrice, noPrice, volumeZat) {
    const stmt = this.db.prepare(`
      UPDATE markets 
      SET yes_price = ?, no_price = ?, volume_zat = volume_zat + ?
      WHERE id = ?
    `);
    return stmt.run(yesPrice, noPrice, volumeZat, marketId);
  }

  // Liquidity pool operations
  getPool(marketId) {
    return this.db.prepare('SELECT * FROM liquidity_pools WHERE market_id = ?').get(marketId);
  }

  updatePool(marketId, yesShares, noShares) {
    const stmt = this.db.prepare(`
      UPDATE liquidity_pools 
      SET yes_shares = ?, no_shares = ?
      WHERE market_id = ?
    `);
    return stmt.run(yesShares, noShares, marketId);
  }

  // Position operations
  getPosition(userId, marketId, side) {
    return this.db.prepare(`
      SELECT * FROM positions WHERE user_id = ? AND market_id = ? AND side = ?
    `).get(userId, marketId, side);
  }

  getUserPositions(userId) {
    return this.db.prepare(`
      SELECT p.*, m.title, m.category, m.yes_price, m.no_price, m.end_date
      FROM positions p
      JOIN markets m ON p.market_id = m.id
      WHERE p.user_id = ?
    `).all(userId);
  }

  upsertPosition(id, userId, marketId, side, shares, avgPrice) {
    const stmt = this.db.prepare(`
      INSERT INTO positions (id, user_id, market_id, side, shares, avg_price, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, market_id, side) DO UPDATE SET
        shares = positions.shares + excluded.shares,
        avg_price = (positions.avg_price * positions.shares + excluded.avg_price * excluded.shares) / (positions.shares + excluded.shares),
        updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(id, userId, marketId, side, shares, avgPrice);
  }

  // Trade operations
  createTrade(id, userId, marketId, side, action, shares, price, amountZat, txHash) {
    const stmt = this.db.prepare(`
      INSERT INTO trades (id, user_id, market_id, side, action, shares, price, amount_zat, tx_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(id, userId, marketId, side, action, shares, price, amountZat, txHash);
  }

  getUserTrades(userId) {
    return this.db.prepare(`
      SELECT t.*, m.title 
      FROM trades t
      JOIN markets m ON t.market_id = m.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `).all(userId);
  }

  updateTradeStatus(tradeId, status) {
    return this.db.prepare('UPDATE trades SET status = ? WHERE id = ?').run(status, tradeId);
  }

  // Transaction operations (deposits/withdrawals)
  createTransaction(id, userId, type, amountZat, txHash, fromAddr, toAddr) {
    const stmt = this.db.prepare(`
      INSERT INTO transactions (id, user_id, type, amount_zat, tx_hash, from_address, to_address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(id, userId, type, amountZat, txHash, fromAddr, toAddr);
  }

  getUserTransactions(userId) {
    return this.db.prepare('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  }

  confirmTransaction(txId) {
    return this.db.prepare(`
      UPDATE transactions SET status = 'confirmed', confirmed_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(txId);
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

export default new DB();

