import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { redis, getKvClient } from './redis';

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(function(this: any, opts: any) {
    this.get = vi.fn();
    this.set = vi.fn();
    // optionally store opts for assertions
    this.opts = opts;
  }),
}));
import { Redis } from '@upstash/redis';

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

describe('land/redis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.UPSTASH_REDIS_REST_URL;
    } else {
      process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    }
    if (originalToken === undefined) {
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
    } else {
      process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    }
  });

  it('getKvClient returns null when env vars missing', () => {
    expect(getKvClient()).toBeNull();
  });

  it('creates Redis client when env vars set', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret';
    const client = getKvClient();
    expect(client).toBeDefined();
    // Trigger lazy initialization of the proxy
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    client.get;
    expect(Redis).toHaveBeenCalledWith({ url: 'https://redis.example.com', token: 'secret' });
  });

  it('redis proxy is defined', () => {
    expect(redis).toBeDefined();
  });
});
