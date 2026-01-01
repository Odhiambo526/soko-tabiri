// Settlement Service - Network Status Routes

import { Router } from 'express';
import { getConnectionStatus, getLatestBlock, getLightdInfo } from '../lightwalletd/client.js';

const router = Router();

/**
 * GET /api/network/status
 * Get Zcash network status
 */
router.get('/status', async (req, res) => {
  try {
    const status = getConnectionStatus();
    
    let blockHeight = null;
    if (status.connected) {
      try {
        const block = await getLatestBlock();
        blockHeight = parseInt(block.height);
      } catch (err) {
        console.warn('Failed to get latest block:', err.message);
      }
    }

    res.json({
      connected: status.connected,
      network: status.network,
      block_height: blockHeight,
      chain_name: status.lightdInfo?.chainName,
      lightwalletd_url: status.lightwalletdUrl,
      mock_mode: status.mockMode,
    });
  } catch (error) {
    console.error('Error getting network status:', error);
    res.status(500).json({ error: 'Failed to get network status' });
  }
});

/**
 * GET /api/network/info
 * Get lightwalletd server info
 */
router.get('/info', async (req, res) => {
  try {
    const info = await getLightdInfo();
    res.json({ info });
  } catch (error) {
    console.error('Error getting lightwalletd info:', error);
    res.status(500).json({ error: 'Failed to get lightwalletd info' });
  }
});

export default router;

