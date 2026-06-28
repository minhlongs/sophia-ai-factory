/**
 * Tests for ip-hash utility
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { hashIp, getDailySalt } from './ip-hash';

describe('hashIp', () => {
  it('returns a 64-char hex string', async () => {
    const hash = await hashIp('192.168.1.1', 'test-salt');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for same input', async () => {
    const hash1 = await hashIp('10.0.0.1', 'salt-2024-01-01');
    const hash2 = await hashIp('10.0.0.1', 'salt-2024-01-01');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different IPs', async () => {
    const hash1 = await hashIp('192.168.1.1', 'same-salt');
    const hash2 = await hashIp('192.168.1.2', 'same-salt');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different salts (daily rotation)', async () => {
    const hash1 = await hashIp('192.168.1.1', '2024-01-01');
    const hash2 = await hashIp('192.168.1.1', '2024-01-02');
    expect(hash1).not.toBe(hash2);
  });

  it('handles IPv6 addresses', async () => {
    const hash = await hashIp('2001:db8::1', 'test-salt');
    expect(hash).toHaveLength(64);
  });
});

describe('getDailySalt', () => {
  afterEach(() => {
    delete process.env.IP_HASH_DAILY_SALT;
  });

  it('returns env var when set', () => {
    process.env.IP_HASH_DAILY_SALT = 'custom-salt-abc123';
    expect(getDailySalt()).toBe('custom-salt-abc123');
  });

  it('returns current UTC date string as fallback', () => {
    delete process.env.IP_HASH_DAILY_SALT;
    const salt = getDailySalt();
    // Should be a date string like 2024-01-15
    expect(salt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
