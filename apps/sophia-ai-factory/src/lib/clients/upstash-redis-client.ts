import { Redis } from '@upstash/redis';

/**
 * Upstash Redis Client (Singleton Pattern)
 * Used for session state management (FSM) and caching
 * TTL defaults: 24h for session state
 */

let redisInstance: Redis | null = null;

export const getRedisClient = (): Redis => {
  if (redisInstance) {
    return redisInstance;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set in production');
    }
    // Dev/build fallback — dummy client that will fail at runtime, not at import
    redisInstance = new Redis({
      url: 'https://dummy-url.upstash.io',
      token: 'dummy_token',
    });
    return redisInstance;
  }

  redisInstance = new Redis({
    url: url.trim(),
    token: token.trim(),
  });

  return redisInstance;
};

// Default TTL for session state (24 hours in seconds)
export const SESSION_TTL = 60 * 60 * 24;

// Helper functions for common operations
export const redisHelpers = {
  async setSession(key: string, value: unknown, ttl: number = SESSION_TTL): Promise<void> {
    const client = getRedisClient();
    await client.set(key, JSON.stringify(value), { ex: ttl });
  },

  async getSession<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    const data = await client.get<string>(key);
    // Redis client might return object if it parses JSON automatically, or string. 
    // Upstash redis client usually parses JSON if it can. 
    // But let's be safe. If it returns string, parse it. If object, cast it.
    if (!data) return null;
    if (typeof data === 'string') {
        try {
            return JSON.parse(data) as T;
        } catch {
            return data as unknown as T;
        }
    }
    return data as T;
  },

  async deleteSession(key: string): Promise<void> {
    const client = getRedisClient();
    await client.del(key);
  },

  async ping(): Promise<boolean> {
    try {
      const client = getRedisClient();
      const result = await client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  },
};

export default getRedisClient;
