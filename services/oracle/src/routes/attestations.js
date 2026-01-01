// Oracle Service - Attestations Routes

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../lib/db.js';
import { attestationCounter } from '../index.js';

const router = Router();

const DISPUTE_WINDOW_HOURS = parseInt(process.env.DISPUTE_WINDOW_HOURS || '24');

/**
 * POST /api/attestations
 * Submit an attestation for a market outcome
 */
router.post('/', async (req, res) => {
  try {
    const {
      reporter_id,
      market_id,
      outcome,
      signature,
      source_name,
      source_url,
      source_timestamp,
      evidence_hash,
    } = req.body;

    // Validate inputs
    if (!reporter_id || !market_id || !outcome || !signature) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['reporter_id', 'market_id', 'outcome', 'signature'],
      });
    }

    if (!['yes', 'no', 'invalid'].includes(outcome)) {
      return res.status(400).json({
        error: 'Invalid outcome',
        valid: ['yes', 'no', 'invalid'],
      });
    }

    // Verify reporter has active stake
    const reporterResult = await query(
      `SELECT s.* FROM stakes s 
       WHERE s.user_id = $1 AND s.stake_type = 'reporter' AND s.status = 'active'`,
      [reporter_id]
    );

    if (reporterResult.rows.length === 0) {
      return res.status(403).json({
        error: 'Not authorized',
        message: 'Reporter must have active stake',
      });
    }

    // Verify market exists and is not already resolved
    const marketResult = await query(
      'SELECT * FROM markets WHERE id = $1',
      [market_id]
    );

    if (marketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Market not found' });
    }

    if (marketResult.rows[0].resolved) {
      return res.status(400).json({ error: 'Market already resolved' });
    }

    // Check if reporter already attested for this market
    const existingResult = await query(
      'SELECT * FROM oracle_attestations WHERE reporter_id = $1 AND market_id = $2',
      [reporter_id, market_id]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already attested for this market' });
    }

    // Create attestation
    const attestationId = uuidv4();
    const result = await query(
      `INSERT INTO oracle_attestations 
       (id, market_id, reporter_id, outcome, signature, source_name, source_url, source_timestamp, evidence_hash, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
       RETURNING *`,
      [attestationId, market_id, reporter_id, outcome, signature, source_name, source_url, source_timestamp, evidence_hash]
    );

    const attestation = result.rows[0];

    // Calculate dispute window end
    const disputeWindowEnd = new Date(Date.now() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);

    // Update metrics
    attestationCounter.inc({ outcome, status: 'pending' });

    res.status(201).json({
      attestation: {
        id: attestation.id,
        market_id: attestation.market_id,
        reporter_id: attestation.reporter_id,
        outcome: attestation.outcome,
        signature: attestation.signature,
        status: attestation.status,
        source_name: attestation.source_name,
        source_url: attestation.source_url,
        created_at: attestation.created_at,
        dispute_window_end: disputeWindowEnd.toISOString(),
      },
    });
  } catch (error) {
    console.error('Error submitting attestation:', error);
    res.status(500).json({ error: 'Failed to submit attestation' });
  }
});

/**
 * GET /api/attestations/market/:marketId
 * Get attestations for a market
 */
router.get('/market/:marketId', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, s.amount_zat as reporter_stake
       FROM oracle_attestations a
       LEFT JOIN stakes s ON s.user_id = a.reporter_id AND s.stake_type = 'reporter'
       WHERE a.market_id = $1
       ORDER BY a.created_at DESC`,
      [req.params.marketId]
    );

    const disputeWindowEnd = new Date(Date.now() + DISPUTE_WINDOW_HOURS * 60 * 60 * 1000);

    res.json({
      attestations: result.rows.map((a) => ({
        id: a.id,
        market_id: a.market_id,
        reporter_id: a.reporter_id,
        outcome: a.outcome,
        status: a.status,
        source_name: a.source_name,
        source_url: a.source_url,
        reporter_stake: a.reporter_stake ? parseInt(a.reporter_stake) : null,
        created_at: a.created_at,
        dispute_window_end: disputeWindowEnd.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching attestations:', error);
    res.status(500).json({ error: 'Failed to fetch attestations' });
  }
});

/**
 * GET /api/attestations/:attestationId
 * Get attestation details
 */
router.get('/:attestationId', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM oracle_attestations WHERE id = $1',
      [req.params.attestationId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attestation not found' });
    }

    const a = result.rows[0];
    res.json({
      attestation: {
        id: a.id,
        market_id: a.market_id,
        reporter_id: a.reporter_id,
        outcome: a.outcome,
        signature: a.signature,
        status: a.status,
        source_name: a.source_name,
        source_url: a.source_url,
        evidence_hash: a.evidence_hash,
        created_at: a.created_at,
      },
    });
  } catch (error) {
    console.error('Error fetching attestation:', error);
    res.status(500).json({ error: 'Failed to fetch attestation' });
  }
});

export default router;

