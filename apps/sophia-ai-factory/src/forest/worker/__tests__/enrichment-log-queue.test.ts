/**
 * Unit tests for enrichment-log-queue
 * @module forest/worker/__tests__/enrichment-log-queue.test
 */

import { describe, it, expect } from 'vitest';
import {
  hashIpSync,
  LOGGER_CONFIG,
} from '../lib/enrichment-log-queue';

describe('hashIpSync', () => {
  it('produces a deterministic hash', () => {
    const hash1 = hashIpSync('192.168.1.1');
    const hash2 = hashIpSync('192.168.1.1');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different IPs', () => {
    const hash1 = hashIpSync('192.168.1.1');
    const hash2 = hashIpSync('10.0.0.1');
    expect(hash1).not.toBe(hash2);
  });

  it('returns 8-character hex string', () => {
    const hash = hashIpSync('192.168.1.1');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles IPv6 addresses', () => {
    const hash = hashIpSync('2001:db8::1');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles empty string', () => {
    const hash = hashIpSync('');
    expect(hash).toBe('00000000');
  });

  it('handles localhost', () => {
    const hash = hashIpSync('127.0.0.1');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('LOGGER_CONFIG', () => {
  it('has required configuration fields', () => {
    expect(LOGGER_CONFIG.flushIntervalMs).toBe(5000);
    expect(LOGGER_CONFIG.maxBatchSize).toBe(100);
    expect(LOGGER_CONFIG.queueEndpoint).toBe('/api/audit/enrichment');
  });

  it('has positive numeric values', () => {
    expect(LOGGER_CONFIG.flushIntervalMs).toBeGreaterThan(0);
    expect(LOGGER_CONFIG.maxBatchSize).toBeGreaterThan(0);
  });
});
