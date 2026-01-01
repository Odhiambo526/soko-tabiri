// Oracle Service - Disputes Routes

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, getPool } from '../lib/db.js';
import { disputeCounter } from '../index.js';

const router = Router();

const DISPUTE_WINDOW_HOURS = parseInt(process.env.DISPUTE_WINDOW_HOURS || '24');

/**
 * POST /api/disputes
 * Open a dispute against an attestation
 */
router.post('/', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const {
      attestation_id,
      disputer_id,
      disputed_outcome,
      reason,
      evidence_hash,
      evidence_url,
    } = req.body;

    // Validate inputs
    if (!attestation_id || !disputer_id || !disputed_outcome || !reason) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['attestation_id', 'disputer_id', 'disputed_outcome', 'reason'],
      });
    }

    if (!['yes', 'no', 'invalid'].includes(disputed_outcome)) {
      return res.status(400).json({
        error: 'Invalid disputed_outcome',
        valid: ['yes', 'no', 'invalid'],
      });
    }

    await client.query('BEGIN');

    // Get attestation
    const attestationResult = await client.query(
      'SELECT * FROM oracle_attestations WHERE id = $1',
      [attestation_id]
    );

    if (attestationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Attestation not found' });
    }

    const attestation = attestationResult.rows[0];

    // Check if attestation is already disputed
    if (attestation.status === 'disputed') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Attestation already disputed' });
    }

    // Check dispute window
    const attestationTime = new Date(attestation.created_at).getTime();
    const windowEnd = attestationTime + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
    
    if (Date.now() > windowEnd) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Dispute window closed',
        window_end: new Date(windowEnd).toISOString(),
      });
    }

    // Check disputer has stake
    const stakeResult = await client.query(
      `SELECT * FROM stakes 
       WHERE user_id = $1 AND stake_type = 'reporter' AND status = 'active'`,
      [disputer_id]
    );

    if (stakeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Disputer must have active stake',
      });
    }

    const stake = stakeResult.rows[0];

    // Lock disputer's stake
    await client.query(
      `UPDATE stakes 
       SET status = 'locked', lock_reason = 'dispute_pending', locked_at = NOW()
       WHERE id = $1`,
      [stake.id]
    );

    // Create dispute
    const disputeId = uuidv4();
    const disputeWindowEnd = new Date(windowEnd);

    const result = await client.query(
      `INSERT INTO disputes 
       (id, attestation_id, market_id, disputer_id, disputer_stake_id, disputed_outcome, reason, evidence_hash, evidence_url, dispute_window_end, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'open')
       RETURNING *`,
      [disputeId, attestation_id, attestation.market_id, disputer_id, stake.id, disputed_outcome, reason, evidence_hash, evidence_url, disputeWindowEnd]
    );

    // Update attestation status
    await client.query(
      `UPDATE oracle_attestations SET status = 'disputed', disputed_at = NOW() WHERE id = $1`,
      [attestation_id]
    );

    await client.query('COMMIT');

    // Update metrics
    disputeCounter.inc({ status: 'open' });

    const dispute = result.rows[0];
    res.status(201).json({
      dispute: {
        id: dispute.id,
        attestation_id: dispute.attestation_id,
        market_id: dispute.market_id,
        disputer_id: dispute.disputer_id,
        disputed_outcome: dispute.disputed_outcome,
        reason: dispute.reason,
        status: dispute.status,
        dispute_window_end: dispute.dispute_window_end,
        created_at: dispute.created_at,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating dispute:', error);
    res.status(500).json({ error: 'Failed to create dispute' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/disputes/:disputeId
 * Get dispute details
 */
router.get('/:disputeId', async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, a.outcome as original_outcome, a.reporter_id
       FROM disputes d
       JOIN oracle_attestations a ON d.attestation_id = a.id
       WHERE d.id = $1`,
      [req.params.disputeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const d = result.rows[0];
    res.json({
      dispute: {
        id: d.id,
        attestation_id: d.attestation_id,
        market_id: d.market_id,
        disputer_id: d.disputer_id,
        disputed_outcome: d.disputed_outcome,
        original_outcome: d.original_outcome,
        reporter_id: d.reporter_id,
        reason: d.reason,
        status: d.status,
        dispute_window_end: d.dispute_window_end,
        resolved_at: d.resolved_at,
        resolution_notes: d.resolution_notes,
        reporter_slashed: d.reporter_slashed,
        disputer_slashed: d.disputer_slashed,
        created_at: d.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching dispute:', error);
    res.status(500).json({ error: 'Failed to fetch dispute' });
  }
});

/**
 * POST /api/disputes/:disputeId/resolve
 * Resolve a dispute
 */
router.post('/:disputeId/resolve', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const { resolution, notes } = req.body;

    if (!['reporter_wins', 'disputer_wins', 'escalate'].includes(resolution)) {
      return res.status(400).json({
        error: 'Invalid resolution',
        valid: ['reporter_wins', 'disputer_wins', 'escalate'],
      });
    }

    await client.query('BEGIN');

    // Get dispute with lock
    const disputeResult = await client.query(
      `SELECT d.*, a.reporter_id
       FROM disputes d
       JOIN oracle_attestations a ON d.attestation_id = a.id
       WHERE d.id = $1
       FOR UPDATE OF d`,
      [req.params.disputeId]
    );

    if (disputeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dispute not found' });
    }

    const dispute = disputeResult.rows[0];

    if (dispute.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Dispute already resolved',
        status: dispute.status,
      });
    }

    let status;
    let reporterSlashed = false;
    let disputerSlashed = false;

    if (resolution === 'reporter_wins') {
      status = 'resolved_for_reporter';
      disputerSlashed = true;

      // Slash disputer's stake
      await client.query(
        `UPDATE stakes 
         SET status = 'slashed', slashed_at = NOW(), slash_reason = 'dispute_lost'
         WHERE id = $1`,
        [dispute.disputer_stake_id]
      );

      // Unlock reporter's stake (if locked)
      // TODO: Create settlement job for slashing
    } else if (resolution === 'disputer_wins') {
      status = 'resolved_for_disputer';
      reporterSlashed = true;

      // Slash reporter's stake
      const reporterStakeResult = await client.query(
        `SELECT id FROM stakes 
         WHERE user_id = $1 AND stake_type = 'reporter' AND status IN ('active', 'locked')`,
        [dispute.reporter_id]
      );

      if (reporterStakeResult.rows.length > 0) {
        await client.query(
          `UPDATE stakes 
           SET status = 'slashed', slashed_at = NOW(), slash_reason = 'attestation_disputed'
           WHERE id = $1`,
          [reporterStakeResult.rows[0].id]
        );
      }

      // Unlock disputer's stake
      await client.query(
        `UPDATE stakes 
         SET status = 'active', lock_reason = NULL, locked_at = NULL
         WHERE id = $1`,
        [dispute.disputer_stake_id]
      );

      // Update attestation
      await client.query(
        `UPDATE oracle_attestations SET status = 'rejected' WHERE id = $1`,
        [dispute.attestation_id]
      );

      // TODO: Create settlement jobs for slashing and reward distribution
    } else {
      status = 'escalated';
      // TODO: Implement escalation to governance
    }

    // Update dispute
    await client.query(
      `UPDATE disputes 
       SET status = $1, resolved_at = NOW(), resolution_notes = $2, 
           reporter_slashed = $3, disputer_slashed = $4
       WHERE id = $5`,
      [status, notes, reporterSlashed, disputerSlashed, req.params.disputeId]
    );

    await client.query('COMMIT');

    // Update metrics
    disputeCounter.inc({ status });

    res.json({
      success: true,
      dispute: {
        id: dispute.id,
        status,
        reporter_slashed: reporterSlashed,
        disputer_slashed: disputerSlashed,
        resolved_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error resolving dispute:', error);
    res.status(500).json({ error: 'Failed to resolve dispute' });
  } finally {
    client.release();
  }
});

/**
 * GET /api/disputes
 * List disputes
 */
router.get('/', async (req, res) => {
  try {
    const { status, market_id, limit = 50, offset = 0 } = req.query;

    let sql = 'SELECT * FROM disputes WHERE 1=1';
    const params = [];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }

    if (market_id) {
      params.push(market_id);
      sql += ` AND market_id = $${params.length}`;
    }

    sql += ' ORDER BY created_at DESC';

    params.push(parseInt(limit));
    sql += ` LIMIT $${params.length}`;

    params.push(parseInt(offset));
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    res.json({
      disputes: result.rows.map((d) => ({
        id: d.id,
        attestation_id: d.attestation_id,
        market_id: d.market_id,
        disputer_id: d.disputer_id,
        disputed_outcome: d.disputed_outcome,
        status: d.status,
        created_at: d.created_at,
      })),
    });
  } catch (error) {
    console.error('Error listing disputes:', error);
    res.status(500).json({ error: 'Failed to list disputes' });
  }
});

export default router;

