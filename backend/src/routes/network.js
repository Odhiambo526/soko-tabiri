import { Router } from 'express';
import zcash from '../services/zcash.js';

const router = Router();

/**
 * GET /api/network/status
 * Get Zcash network status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await zcash.getNetworkStatus();
    
    res.json({
      zcash: status,
      server: {
        version: '1.0.0',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
      }
    });
  } catch (error) {
    console.error('Error getting network status:', error);
    res.status(500).json({ error: 'Failed to get network status' });
  }
});

/**
 * GET /api/network/info
 * Get lightwalletd info
 */
router.get('/info', async (req, res) => {
  try {
    if (!zcash.connected) {
      return res.json({
        connected: false,
        message: 'Running in offline mode',
        network: zcash.network
      });
    }

    const info = await zcash.getLightdInfo();
    res.json({
      connected: true,
      ...info
    });
  } catch (error) {
    console.error('Error getting lightwalletd info:', error);
    res.status(500).json({ error: 'Failed to get lightwalletd info' });
  }
});

/**
 * GET /api/network/block/:height
 * Get block at specific height
 */
router.get('/block/:height', async (req, res) => {
  try {
    if (!zcash.connected) {
      return res.status(503).json({ error: 'Not connected to Zcash network' });
    }

    const height = parseInt(req.params.height);
    const block = await zcash.getBlock(height);
    
    res.json({
      height: block.height,
      hash: Buffer.from(block.hash).toString('hex'),
      time: block.time,
      txCount: block.vtx?.length || 0
    });
  } catch (error) {
    console.error('Error getting block:', error);
    res.status(500).json({ error: 'Failed to get block' });
  }
});

/**
 * POST /api/network/validate-address
 * Validate a Zcash address
 */
router.post('/validate-address', (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address required' });
    }

    const result = zcash.validateAddress(address);
    res.json(result);
  } catch (error) {
    console.error('Error validating address:', error);
    res.status(500).json({ error: 'Failed to validate address' });
  }
});

export default router;

