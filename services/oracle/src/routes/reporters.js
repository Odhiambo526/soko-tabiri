// Oracle Service - Reporters Routes

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, getPool } from '../lib/db.js';
import { activeReportersGauge } from '../index.js';

const router = Router();

const MIN_STAKE_ZAT = parseInt(process.env.MIN_STAKE_ZAT || '100000000'); // 1 ZEC default

/**
 * POST /api/reporters
 * Register as a reporter with bonded stake
 */
router.post('/', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { user_id, stake_amount_zat } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id required' });
    }

    if (!stake_amount_zat || stake_amount_zat < MIN_STAKE_ZAT) {
      return res.status(400).json({
        error: 'Insufficient stake',
        minimum: MIN_STAKE_ZAT,
        minimum_zec: MIN_STAKE_ZAT / 100000000,
      });
    }

    await client.query('BEGIN');

    // Check user exists and has balance
    const userResult = await client.query(
      'SELECT * FROM users WHERE id = $1',
      [user_id]
    );

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }

    // Check balance
    const balanceResult = await client.query(
      'SELECT * FROM balances WHERE user_id = $1 FOR UPDATE',
      [user_id]
    );

    if (balanceResult.rows.length === 0 || 
        BigInt(balanceResult.rows[0].available_zat) < BigInt(stake_amount_zat)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    // Check if already a reporter
    const existingResult = await client.query(
      `SELECT s.* FROM stakes s 
       WHERE s.user_id = $1 AND s.stake_type = 'reporter' AND s.status = 'active'`,
      [user_id]
    );

    if (existingResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already registered as reporter' });
    }

    // Deduct from balance
    await client.query(
      `UPDATE balances 
       SET available_zat = available_zat - $1, locked_zat = locked_zat + $1
       WHERE user_id = $2`,
      [stake_amount_zat, user_id]
    );

    // Create stake
    const stakeId = uuidv4();
    await client.query(
      `INSERT INTO stakes (id, user_id, stake_type, amount_zat, status)
       VALUES ($1, $2, 'reporter', $3, 'active')`,
      [stakeId, user_id, stake_amount_zat]
    );

    await client.query('COMMIT');

    // Update metrics
    activeReportersGauge.inc();

    res.status(201).json({
      reporter: {
        id: stakeId,
        user_id,
        stake_id: stakeId,
        stake_amount_zat: parseInt(stake_amount_zat),
        status: 'active',
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error registering reporter:', error);
    res.status(500).json({ error: 'Failed to register reporter' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/reporters
 * List registered reporters
 */
router.get('/', async (req, res) => {
  try {
    const { status = 'active' } = req.query;

    const result = await query(
      `SELECT s.id, s.user_id, s.amount_zat, s.status, s.created_at,
              COUNT(a.id) as attestation_count
       FROM stakes s
       LEFT JOIN oracle_attestations a ON a.reporter_id = s.user_id
       WHERE s.stake_type = 'reporter' AND s.status = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [status]
    );

    res.json({
      reporters: result.rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        stake_id: r.id,
        stake_amount_zat: parseInt(r.amount_zat),
        status: r.status,
        attestation_count: parseInt(r.attestation_count),
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Error listing reporters:', error);
    res.status(500).json({ error: 'Failed to list reporters' });
  }
});

/**
 * GET /api/reporters/:reporterId
 * Get reporter details
 */
router.get('/:reporterId', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, 
              COUNT(a.id) as attestation_count,
              COUNT(CASE WHEN a.status = 'accepted' THEN 1 END) as accepted_count
       FROM stakes s
       LEFT JOIN oracle_attestations a ON a.reporter_id = s.user_id
       WHERE s.id = $1 AND s.stake_type = 'reporter'
       GROUP BY s.id`,
      [req.params.reporterId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Reporter not found' });
    }

    const r = result.rows[0];
    const attestationCount = parseInt(r.attestation_count);
    const acceptedCount = parseInt(r.accepted_count);

    res.json({
      reporter: {
        id: r.id,
        user_id: r.user_id,
        stake_id: r.id,
        stake_amount_zat: parseInt(r.amount_zat),
        status: r.status,
        attestation_count: attestationCount,
        accuracy_rate: attestationCount > 0 ? acceptedCount / attestationCount : null,
        created_at: r.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching reporter:', error);
    res.status(500).json({ error: 'Failed to fetch reporter' });
  }
});

export default router;

