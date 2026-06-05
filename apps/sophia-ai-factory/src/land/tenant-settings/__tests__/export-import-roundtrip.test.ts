/**
 * End-to-end round-trip test for tenant settings export → import.
 * Covers all active namespaces including channels (templates) and mcp (customServers).
 * Uses FakeD1 backed by better-sqlite3 for reliable in-memory persistence.
 *
 * @module lib/tenant-settings/__tests__/export-import-roundtrip.test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  set,
  get,
  bulkExport,
  bulkImport,
  deleteNamespace,
} from '../registry';
import type { SettingsNamespace } from '../types';
import { createFakeD1 } from '../../../forest/publishing/__tests__/fake-d1-sqlite';
import type { D1Database } from '@cloudflare/workers-types';

// Mock token-crypto so tests don't need OAUTH_TOKEN_ENC_KEY
vi.mock('@/tree/crypto/token-crypto', () => ({
  encryptToken: vi.fn(async (val: string) => `encrypted:${val}`),
  decryptToken: vi.fn(async (val: string) =>
    val.startsWith('encrypted:') ? val.slice(10) : val,
  ),
}));

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tenant_settings (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    namespace TEXT NOT NULL,
    value TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(tenant_id, namespace)
  )`,
];

function makeDb() {
  return createFakeD1(SCHEMA) as unknown as D1Database;
}

const TENANT = 'tenant-roundtrip-test';

// Full fixture covering all namespaces
const FIXTURE: Partial<Record<SettingsNamespace, unknown>> = {
  branding: {
    logoUrl: 'https://cdn.example.com/logo.png',
    primaryColor: '#7c3aed',
    accentColor: '#a78bfa',
    welcomeMessage: 'Welcome to Sophia!',
    customDomain: 'my.sophia.io',
    emailFromName: 'Sophia Team',
    emailFooter: null,
    faviconUrl: null,
    socialMeta: null,
  },
  scoring: {
    weights: { commission: 0.4, cookieDuration: 0.2, payoutSpeed: 0.15, programAge: 0.15, approvalRate: 0.1 },
    threshold: 0.75,
  },
  geo: {
    additionalRules: [{ category: 'gambling', blockedCountries: ['US', 'AU'], reason: 'compliance' }],
    removedRules: [],
  },
  cron: {
    affiliateScoutCadenceHours: 6,
    contentProducerCron: '0 8 * * *',
    enabled: { affiliateScout: true, contentProducer: false },
  },
  channels: {
    defaultPlatforms: ['youtube', 'tiktok'],
    templates: {
      youtube: {
        titleTemplate: '{productName} Review — Earn {commission}%',
        captionTemplate: 'Check out {productName} via {network}! {ctaUrl}',
        hashtagsTemplate: '#affiliate #{network} #review',
      },
      tiktok: {
        captionTemplate: '{productName} 🔥 {commission}% commission! {ctaUrl}',
      },
    },
    preferTemplateOverAI: true,
  },
  mcp: {
    enabledServers: ['supabase'],
    customEndpoints: [],
    customServers: [
      {
        name: 'my-analytics',
        url: 'https://analytics.example.com/mcp',
        authType: 'bearer',
        authValue: 'encrypted:super-secret-token',
        enabled: true,
        description: 'Analytics MCP server',
      },
    ],
  },
};

describe('Export → Import round-trip', () => {
  let dbA: D1Database;
  let dbB: D1Database;

  beforeEach(() => {
    dbA = makeDb();
    dbB = makeDb();
  });

  it('exports all set namespaces and re-imports them with deep equality', async () => {
    // Set all namespaces on dbA
    for (const [ns, val] of Object.entries(FIXTURE)) {
      await set(dbA, TENANT, ns as SettingsNamespace, val);
    }

    // Export
    const exported = await bulkExport(dbA, TENANT);

    // Verify exported keys match what we set
    expect(Object.keys(exported).sort()).toEqual(Object.keys(FIXTURE).sort());

    // Import into dbB
    await bulkImport(dbB, TENANT, exported as Partial<Record<SettingsNamespace, unknown>>);

    // Verify deep equality for each namespace
    for (const ns of Object.keys(FIXTURE) as SettingsNamespace[]) {
      const original = exported[ns];
      const restored = await get(dbB, TENANT, ns);
      expect(restored).toEqual(original);
    }
  });

  it('branding round-trips correctly', async () => {
    await set(dbA, TENANT, 'branding', FIXTURE.branding);
    const exported = await bulkExport(dbA, TENANT);
    await bulkImport(dbB, TENANT, exported as Partial<Record<SettingsNamespace, unknown>>);
    const restored = await get(dbB, TENANT, 'branding');
    expect(restored).toEqual(FIXTURE.branding);
  });

  it('channels templates round-trip correctly', async () => {
    await set(dbA, TENANT, 'channels', FIXTURE.channels);
    const exported = await bulkExport(dbA, TENANT);
    await bulkImport(dbB, TENANT, exported as Partial<Record<SettingsNamespace, unknown>>);
    const restored = await get<typeof FIXTURE.channels>(dbB, TENANT, 'channels');
    expect((restored as { preferTemplateOverAI?: boolean })?.preferTemplateOverAI).toBe(true);
    expect((restored as { templates?: { youtube?: { titleTemplate?: string } } })?.templates?.youtube?.titleTemplate)
      .toBe('{productName} Review — Earn {commission}%');
  });

  it('mcp customServers with authValues preserved encrypted', async () => {
    await set(dbA, TENANT, 'mcp', FIXTURE.mcp);
    const exported = await bulkExport(dbA, TENANT);
    await bulkImport(dbB, TENANT, exported as Partial<Record<SettingsNamespace, unknown>>);

    const restored = await get<{
      customServers: Array<{ name: string; authValue?: string }>;
    }>(dbB, TENANT, 'mcp');

    const server = restored?.customServers?.find(s => s.name === 'my-analytics');
    expect(server).toBeDefined();
    // authValue should be preserved as-is (encrypted string)
    expect(server?.authValue).toBe('encrypted:super-secret-token');
  });

  it('wipe then import restores settings', async () => {
    for (const [ns, val] of Object.entries(FIXTURE)) {
      await set(dbA, TENANT, ns as SettingsNamespace, val);
    }

    const exported = await bulkExport(dbA, TENANT);

    // Wipe all namespaces
    for (const ns of Object.keys(FIXTURE) as SettingsNamespace[]) {
      await deleteNamespace(dbA, TENANT, ns);
    }

    // Verify wiped
    for (const ns of Object.keys(FIXTURE) as SettingsNamespace[]) {
      expect(await get(dbA, TENANT, ns)).toBeNull();
    }

    // Re-import
    await bulkImport(dbA, TENANT, exported as Partial<Record<SettingsNamespace, unknown>>);

    // Verify restored
    for (const ns of Object.keys(FIXTURE) as SettingsNamespace[]) {
      const restored = await get(dbA, TENANT, ns);
      expect(restored).toEqual(exported[ns]);
    }
  });

  it('geo rules round-trip correctly', async () => {
    await set(dbA, TENANT, 'geo', FIXTURE.geo);
    const exported = await bulkExport(dbA, TENANT);
    await bulkImport(dbB, TENANT, exported as Partial<Record<SettingsNamespace, unknown>>);
    const restored = await get(dbB, TENANT, 'geo');
    expect(restored).toEqual(FIXTURE.geo);
  });

  it('cron settings round-trip correctly', async () => {
    await set(dbA, TENANT, 'cron', FIXTURE.cron);
    const exported = await bulkExport(dbA, TENANT);
    await bulkImport(dbB, TENANT, exported as Partial<Record<SettingsNamespace, unknown>>);
    const restored = await get(dbB, TENANT, 'cron');
    expect(restored).toEqual(FIXTURE.cron);
  });
});
