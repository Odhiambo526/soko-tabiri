// Soko Tabiri - HMAC Authentication for Service-to-Service Calls
// Used for internal API authentication between microservices

import crypto from 'crypto';

const HMAC_HEADER = 'X-Soko-Signature';
const TIMESTAMP_HEADER = 'X-Soko-Timestamp';
const TIMESTAMP_TOLERANCE_MS = 300000; // 5 minutes

/**
 * Create HMAC signature for a request
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {string} body - Request body (stringified JSON)
 * @param {string} timestamp - Unix timestamp
 * @param {string} secret - HMAC secret
 * @returns {string} HMAC signature
 */
export function signRequest(method, path, body, timestamp, secret) {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body || ''}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify HMAC signature
 * @param {string} signature - Received signature
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {string} body - Request body
 * @param {string} timestamp - Unix timestamp
 * @param {string} secret - HMAC secret
 * @returns {boolean} Whether signature is valid
 */
export function verifyHmac(signature, method, path, body, timestamp, secret) {
  const expected = signRequest(method, path, body, timestamp, secret);
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

/**
 * Express middleware for HMAC authentication
 * @param {string} secret - HMAC secret
 * @returns {Function} Express middleware
 */
export function createHmacMiddleware(secret) {
  return (req, res, next) => {
    // Skip health checks
    if (req.path === '/health' || req.path === '/metrics') {
      return next();
    }

    const signature = req.headers[HMAC_HEADER.toLowerCase()];
    const timestamp = req.headers[TIMESTAMP_HEADER.toLowerCase()];

    if (!signature || !timestamp) {
      return res.status(401).json({
        error: 'Missing authentication headers',
        required: [HMAC_HEADER, TIMESTAMP_HEADER],
      });
    }

    // Check timestamp freshness
    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > TIMESTAMP_TOLERANCE_MS) {
      return res.status(401).json({
        error: 'Request timestamp expired or invalid',
      });
    }

    // Verify signature
    const body = JSON.stringify(req.body) || '';
    const isValid = verifyHmac(signature, req.method, req.path, body, timestamp, secret);

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid signature',
      });
    }

    next();
  };
}

export default { signRequest, verifyHmac, createHmacMiddleware };

