// Settlement Service - Jobs Routes
// Privacy: Enforces shielded-only by default. T-address requires explicit flags.

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../lib/db.js';
import { pendingJobsGauge, processedJobsCounter, settlementVolumeCounter } from '../index.js';

const router = Router();

// Privacy configuration
const ALLOW_DESHIELD = process.env.ALLOW_DESHIELD === 'true';
const DESHIELD_KYC = process.env.DESHIELD_KYC === 'true';

const VALID_JOB_TYPES = ['trade_settlement', 'payout', 'stake_deposit', 'stake_withdrawal', 'slash'];
const VALID_TX_TYPES = ['shielded', 'transparent', 'deshield'];

/**
 * POST /api/jobs
 * Submit a settlement job
 */
router.post('/', async (req, res) => {
  try {
    const {
      job_type,
      fill_id,
      stake_id,
      market_id,
      user_id,
      amount_zat,
      tx_type = 'shielded', // Default to shielded
    } = req.body;

    // Validate job_type
    if (!VALID_JOB_TYPES.includes(job_type)) {
      return res.status(400).json({
        error: 'Invalid job_type',
        valid: VALID_JOB_TYPES,
      });
    }

    // Validate amount
    if (!amount_zat || amount_zat <= 0) {
      return res.status(400).json({ error: 'Invalid amount_zat' });
    }

    // Validate tx_type
    if (!VALID_TX_TYPES.includes(tx_type)) {
      return res.status(400).json({
        error: 'Invalid tx_type',
        valid: VALID_TX_TYPES,
      });
    }

    // Privacy enforcement: Block transparent/deshield unless explicitly allowed
    if (tx_type !== 'shielded') {
      if (!ALLOW_DESHIELD) {
        return res.status(422).json({
          error: 'Transparent/deshield transactions are not allowed',
          message: 'Set ALLOW_DESHIELD=true to enable (requires KYC)',
          privacy: 'Soko Tabiri enforces shielded-first privacy by default',
        });
      }
      if (!DESHIELD_KYC) {
        return res.status(422).json({
          error: 'Deshield transactions require KYC verification',
          message: 'Set DESHIELD_KYC=true after implementing KYC flow',
          privacy: 'T-address flows expose transaction history on-chain',
        });
      }
      // TODO: Verify user has completed KYC
      // if (user_id) {
      //   const userResult = await query('SELECT kyc_verified FROM users WHERE id = $1', [user_id]);
      //   if (!userResult.rows[0]?.kyc_verified) {
      //     return res.status(422).json({ error: 'User KYC not verified' });
      //   }
      // }
    }

    // Create job
    const jobId = uuidv4();
    const result = await query(
      `INSERT INTO settlement_jobs 
       (id, job_type, fill_id, stake_id, market_id, user_id, amount_zat, tx_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [jobId, job_type, fill_id, stake_id, market_id, user_id, amount_zat, tx_type]
    );

    const job = result.rows[0];

    // Update metrics
    pendingJobsGauge.inc();

    res.status(201).json({
      job: {
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        amount_zat: parseInt(job.amount_zat),
        tx_type: job.tx_type,
        created_at: job.created_at,
      },
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create settlement job' });
  }
});

/**
 * GET /api/jobs/:jobId
 * Get job status
 */
router.get('/:jobId', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM settlement_jobs WHERE id = $1',
      [req.params.jobId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = result.rows[0];
    res.json({
      job: {
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        amount_zat: parseInt(job.amount_zat),
        tx_type: job.tx_type,
        tx_hash: job.tx_hash,
        block_height: job.block_height ? parseInt(job.block_height) : null,
        confirmations: job.confirmations,
        error_message: job.error_message,
        created_at: job.created_at,
        processing_at: job.processing_at,
        submitted_at: job.submitted_at,
        confirmed_at: job.confirmed_at,
      },
    });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

/**
 * POST /api/jobs/:jobId/cancel
 * Cancel a pending job
 */
router.post('/:jobId/cancel', async (req, res) => {
  try {
    const result = await query(
      `UPDATE settlement_jobs 
       SET status = 'cancelled', failed_at = NOW()
       WHERE id = $1 AND status = 'pending'
       RETURNING *`,
      [req.params.jobId]
    );

    if (result.rows.length === 0) {
      // Check if job exists
      const existsResult = await query(
        'SELECT status FROM settlement_jobs WHERE id = $1',
        [req.params.jobId]
      );

      if (existsResult.rows.length === 0) {
        return res.status(404).json({ error: 'Job not found' });
      }

      return res.status(400).json({
        error: 'Job cannot be cancelled',
        currentStatus: existsResult.rows[0].status,
      });
    }

    // Update metrics
    pendingJobsGauge.dec();
    processedJobsCounter.inc({ job_type: result.rows[0].job_type, status: 'cancelled' });

    res.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
});

/**
 * GET /api/jobs
 * List jobs (with filters)
 */
router.get('/', async (req, res) => {
  try {
    const { status, job_type, user_id, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM settlement_jobs WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (job_type) {
      params.push(job_type);
      sql += ` AND job_type = $${params.length}`;
    }

    if (user_id) {
      params.push(user_id);
      sql += ` AND user_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;

    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    res.json({
      jobs: result.rows.map((job) => ({
        id: job.id,
        job_type: job.job_type,
        status: job.status,
        amount_zat: parseInt(job.amount_zat),
        tx_type: job.tx_type,
        created_at: job.created_at,
      })),
    });
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

export default router;

