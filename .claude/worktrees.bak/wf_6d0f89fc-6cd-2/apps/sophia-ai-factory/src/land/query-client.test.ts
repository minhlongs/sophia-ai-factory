import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { createQueryClient, queryKeys } from './query-client';

describe('query-client', () => {
  describe('createQueryClient', () => {
    it('creates a QueryClient instance', () => {
      const client = createQueryClient();
      expect(client).toBeInstanceOf(QueryClient);
    });

    it('creates a fresh instance each call', () => {
      const client1 = createQueryClient();
      const client2 = createQueryClient();
      expect(client1).not.toBe(client2);
    });

    it('applies default query configuration', () => {
      const client = createQueryClient();
      const defaultOptions = client.getDefaultOptions();
      const queries = defaultOptions.queries;
      if (!queries) {
        throw new Error('Expected defaultOptions.queries to be defined');
      }

      expect(queries.staleTime).toBe(30_000);
      expect(queries.gcTime).toBe(5 * 60 * 1000);
      expect(queries.refetchOnWindowFocus).toBe(false);
      expect(queries.retry).toBe(2);
      expect(queries.refetchOnReconnect).toBe(true);
    });

    it('does not mutate config between instances', () => {
      const client1 = createQueryClient();
      const client2 = createQueryClient();

      expect(client1.getDefaultOptions()).toEqual(client2.getDefaultOptions());
    });
  });

  describe('queryKeys', () => {
    describe('usage keys', () => {
      it('has correct base key', () => {
        expect(queryKeys.usage.all).toEqual(['usage']);
      });

      it('generates list keys with filters', () => {
        const filters = { start: 1000, end: 2000, granularity: 'hour', service: 'video' };
        const key = queryKeys.usage.list(filters);
        expect(key).toEqual(['usage', 'list', filters]);
      });

      it('generates detail keys with nonce', () => {
        const key = queryKeys.usage.detail('nonce-123');
        expect(key).toEqual(['usage', 'detail', 'nonce-123']);
      });

      it('handles minimal list filters', () => {
        const filters = { start: 1000, end: 2000 };
        const key = queryKeys.usage.list(filters);
        expect(key[0]).toBe('usage');
        expect(key[1]).toBe('list');
        expect(key[2]).toEqual(filters);
      });
    });

    describe('license keys', () => {
      it('has correct base key', () => {
        expect(queryKeys.license.all).toEqual(['license']);
      });

      it('generates list keys with optional filters', () => {
        const key1 = queryKeys.license.list({ status: 'active' });
        const key2 = queryKeys.license.list({ tier: 'enterprise' });
        const key3 = queryKeys.license.list({ status: 'active', tier: 'enterprise' });

        expect(key1).toEqual(['license', 'list', { status: 'active' }]);
        expect(key2).toEqual(['license', 'list', { tier: 'enterprise' }]);
        expect(key3).toEqual(['license', 'list', { status: 'active', tier: 'enterprise' }]);
      });

      it('generates utilization key', () => {
        const key = queryKeys.license.utilization();
        expect(key).toEqual(['license', 'utilization']);
      });
    });

    describe('revenue keys', () => {
      it('has correct base key', () => {
        expect(queryKeys.revenue.all).toEqual(['revenue']);
      });

      it('generates list keys with period and optional tier', () => {
        const key1 = queryKeys.revenue.list({ period: 'monthly' });
        const key2 = queryKeys.revenue.list({ period: 'yearly', tier: 'master' });

        expect(key1).toEqual(['revenue', 'list', { period: 'monthly' }]);
        expect(key2).toEqual(['revenue', 'list', { period: 'yearly', tier: 'master' }]);
      });

      it('requires period parameter', () => {
        // TypeScript should enforce this, but we can test runtime
        const key = queryKeys.revenue.list({ period: 'q1' });
        expect(key[2]).toHaveProperty('period', 'q1');
      });
    });

    describe('raas keys', () => {
      it('generates usage key with start and end', () => {
        const key = queryKeys.raas.usage(1000, 2000);
        expect(key).toEqual(['raas', 'usage', 1000, 2000]);
      });

      it('generates billing key with period', () => {
        const key = queryKeys.raas.billing('2024-01');
        expect(key).toEqual(['raas', 'billing', '2024-01']);
      });

      it('generates licenses key', () => {
        const key = queryKeys.raas.licenses();
        expect(key).toEqual(['raas', 'licenses']);
      });
    });

    describe('key stability', () => {
      it('produces stable keys for same inputs', () => {
        const filters = { start: 1000, end: 2000 };
        const key1 = queryKeys.usage.list(filters);
        const key2 = queryKeys.usage.list(filters);

        expect(key1).toEqual(key2);
      });

      it('different filter objects produce different keys', () => {
        const key1 = queryKeys.usage.list({ start: 1000, end: 2000 });
        const key2 = queryKeys.usage.list({ start: 2000, end: 3000 });

        expect(key1).not.toEqual(key2);
      });
    });
  });
});
