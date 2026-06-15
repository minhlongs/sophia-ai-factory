/**
 * Tests for mock affiliate network client
 */

import { describe, it, expect } from 'vitest';
import { mockClient } from '../client-mock';

describe('mockClient', () => {
  it('has network = mock', () => {
    expect(mockClient.network).toBe('mock');
  });

  it('returns exactly 3 affiliates', async () => {
    const result = await mockClient.fetch({}, 'tenant-1');
    expect(result).toHaveLength(3);
  });

  it('returns deterministic results on repeated calls', async () => {
    const a = await mockClient.fetch({}, 'tenant-1');
    const b = await mockClient.fetch({}, 'tenant-1');
    expect(a).toEqual(b);
  });

  it('returns deterministic results for different tenants', async () => {
    const a = await mockClient.fetch({}, 'tenant-x');
    const b = await mockClient.fetch({}, 'tenant-y');
    expect(a).toEqual(b);
  });

  it('each affiliate has required fields', async () => {
    const results = await mockClient.fetch({}, 't');
    for (const aff of results) {
      expect(aff.network).toBe('mock');
      expect(typeof aff.externalId).toBe('string');
      expect(aff.externalId.length).toBeGreaterThan(0);
      expect(typeof aff.productName).toBe('string');
      expect(aff.productName.length).toBeGreaterThan(0);
    }
  });

  it('affiliate externalIds are unique', async () => {
    const results = await mockClient.fetch({}, 't');
    const ids = results.map(a => a.externalId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
