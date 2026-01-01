// Engine Service - Redis Client

import { createClient } from 'redis';

let client = null;

export async function createRedisClient(url) {
  if (client) return client;

  client = createClient({
    url: url || process.env.REDIS_URL,
  });

  client.on('error', (err) => {
    console.error('Redis client error:', err);
  });

  await client.connect();
  return client;
}

export function getRedis() {
  return client;
}

export default { createRedisClient, getRedis };

