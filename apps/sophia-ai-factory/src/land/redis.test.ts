import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redis, getKvClient } from './redis';

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({ get: vi.fn(), set: vi.fn() })),
}));
import { Redis } from '@upstash/redis';

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

describe('land/redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.UPSTASH_REDIS_REST_URL = undefined;
    process.env.UPSTASH_REDIS_REST_TOKEN = undefined;
  });

  afterEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it('getKvClient returns null when env vars missing', () => {
    expect(getKvClient()).toBeNull();
  });

  it('creates Redis client when env vars set', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    const client = getKvClient();
    expect(client).toBeDefined();
    expect(Redis).toHaveBeenCalledWith({ url: 'https://redis.example.com', token: 'secret' });
  });

  it('redis proxy is defined', () => {
    expect(redis).toBeDefined();
  });
});
