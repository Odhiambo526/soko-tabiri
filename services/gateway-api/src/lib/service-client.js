// Gateway API - Internal Service Client
// Makes HMAC-authenticated calls to internal services

import crypto from 'crypto';

const HMAC_HEADER = 'X-Soko-Signature';
const TIMESTAMP_HEADER = 'X-Soko-Timestamp';

/**
 * Create HMAC signature for a request
 */
function signRequest(method, path, body, timestamp, secret) {
  const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body || ''}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Make an authenticated request to an internal service
 * @param {string} baseUrl - Service base URL
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Response data
 */
export async function serviceRequest(baseUrl, method, path, body = null) {
  const secret = process.env.INTERNAL_HMAC_SECRET;
  if (!secret) {
    throw new Error('INTERNAL_HMAC_SECRET not configured');
  }

  const timestamp = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = signRequest(method, path, bodyStr, timestamp, secret);

  const url = `${baseUrl}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      [HMAC_HEADER]: signature,
      [TIMESTAMP_HEADER]: timestamp,
    },
  };

  if (body) {
    options.body = bodyStr;
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Service request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// Service-specific clients
export const engineClient = {
  async getQuote(marketId, side, amountZat) {
    return serviceRequest(
      process.env.ENGINE_URL,
      'POST',
      `/api/quote`,
      { marketId, side, amountZat }
    );
  },
  async executeTrade(marketId, userId, side, amountZat) {
    return serviceRequest(
      process.env.ENGINE_URL,
      'POST',
      `/api/trade`,
      { marketId, userId, side, amountZat }
    );
  },
};

export const settlementClient = {
  async getJobStatus(jobId) {
    return serviceRequest(
      process.env.SETTLEMENT_URL,
      'GET',
      `/api/jobs/${jobId}`
    );
  },
  async submitJob(job) {
    return serviceRequest(
      process.env.SETTLEMENT_URL,
      'POST',
      `/api/jobs`,
      job
    );
  },
};

export const oracleClient = {
  async getAttestation(marketId) {
    return serviceRequest(
      process.env.ORACLE_URL,
      'GET',
      `/api/attestations/market/${marketId}`
    );
  },
};

export default { serviceRequest, engineClient, settlementClient, oracleClient };

