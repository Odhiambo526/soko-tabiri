// Settlement Service - Address Routes

import { Router } from 'express';
import { validateAddress } from '../lightwalletd/client.js';

const router = Router();

/**
 * POST /api/address/validate
 * Validate a Zcash address
 */
router.post('/validate', (req, res) => {
  const { address } = req.body;
  
  if (!address) {
    return res.status(400).json({ error: 'Address required' });
  }

  const result = validateAddress(address);
  res.json(result);
});

export default router;

