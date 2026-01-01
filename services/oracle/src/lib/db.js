// Oracle Service - Database Connection

import pg from 'pg';
const { Pool } = pg;

let pool = null;

export async function createDbPool(connectionString) {
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

  await pool.query('SELECT NOW()');
  return pool;
}

export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool.query(text, params);
}

export function getPool() {
  return pool;
}

export default { createDbPool, query, getPool };

