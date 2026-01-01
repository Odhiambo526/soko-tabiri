// Engine Service - Health Check Routes

import { Router } from 'express';
import { getPool } from '../lib/db.js';
import { getRedis } from '../lib/redis.js';

const router = Router();

router.get('/', async (req, res) => {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'engine',
    version: process.env.npm_package_version || '1.0.0',
    checks: {},
  };

  try {
    const pool = getPool();
    if (pool) {
      await pool.query('SELECT 1');
      checks.checks.database = { status: 'ok' };
    } else {
      checks.checks.database = { status: 'not_connected' };
    }
  } catch (err) {
    checks.checks.database = { status: 'error', message: err.message };
    checks.status = 'degraded';
  }

  try {
    const redis = getRedis();
    if (redis) {
      await redis.ping();
      checks.checks.redis = { status: 'ok' };
    } else {
      checks.checks.redis = { status: 'not_connected' };
    }
  } catch (err) {
    checks.checks.redis = { status: 'error', message: err.message };
    checks.status = 'degraded';
  }

  const statusCode = checks.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(checks);
});

router.get('/live', (req, res) => {
  res.json({ status: 'ok' });
});

router.get('/ready', async (req, res) => {
  try {
    const pool = getPool();
    const redis = getRedis();
    
    if (!pool || !redis) {
      return res.status(503).json({ status: 'not_ready' });
    }

    await pool.query('SELECT 1');
    await redis.ping();
    
    res.json({ status: 'ready' });
  } catch (err) {
    res.status(503).json({ status: 'not_ready', error: err.message });
  }
});

export default router;

