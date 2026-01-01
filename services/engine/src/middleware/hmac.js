// Engine Service - HMAC Authentication Middleware

import crypto from 'crypto';

const HMAC_HEADER = 'x-soko-signature';
const TIMESTAMP_HEADER = 'x-soko-timestamp';
const TIMESTAMP_TOLERANCE_MS = 300000; // 5 minutes

function signRequest(method, path, body, timestamp, secret) {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body || ''}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function createHmacMiddleware(secret) {
  return (req, res, next) => {
    const signature = req.headers[HMAC_HEADER];
    const timestamp = req.headers[TIMESTAMP_HEADER];

    if (!signature || !timestamp) {
      return res.status(401).json({
        error: 'Missing authentication headers',
      });
    }

    const now = Date.now();
    const requestTime = parseInt(timestamp, 10);
    if (isNaN(requestTime) || Math.abs(now - requestTime) > TIMESTAMP_TOLERANCE_MS) {
      return res.status(401).json({
        error: 'Request timestamp expired or invalid',
      });
    }

    const body = JSON.stringify(req.body) || '';
    const expected = signRequest(req.method, req.path, body, timestamp, secret);

    if (signature.length !== expected.length) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  };
}

export default { createHmacMiddleware };

