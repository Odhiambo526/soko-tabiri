// Soko Tabiri - Database Connection Pool
// ASSUMPTION: pg ^8.11.0 - standard Postgres client for Node.js

import pg from 'pg';
const { Pool } = pg;

let pool = null;

/**
 * Create a database connection pool
 * @param {string} connectionString - Postgres connection URL
 * @returns {Pool}
 */
export function createDbPool(connectionString) {
  if (pool) return pool;

  pool = new Pool({
    connectionString: connectionString || process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected database pool error:', err);
  });

  return pool;
}

/**
 * Execute a query
 * @param {string} text - SQL query
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool not initialized. Call createDbPool first.');
  }
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  
  // Log slow queries (> 100ms)
  if (duration > 100) {
    console.warn(`Slow query (${duration}ms):`, text.substring(0, 100));
  }
  
  return result;
}

export default { createDbPool, query };

