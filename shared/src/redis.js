// Soko Tabiri - Redis Client
// ASSUMPTION: redis ^4.6.0 - standard Redis client for Node.js

import { createClient } from 'redis';

let client = null;

/**
 * Create a Redis client
 * @param {string} url - Redis connection URL
 * @returns {Promise<RedisClient>}
 */
export async function createRedisClient(url) {
  if (client) return client;

  client = createClient({
    url: url || process.env.REDIS_URL,
  });

  client.on('error', (err) => {
    console.error('Redis client error:', err);
  });

  client.on('connect', () => {
    console.log('Connected to Redis');
  });

  await client.connect();
  return client;
}

export default { createRedisClient };

