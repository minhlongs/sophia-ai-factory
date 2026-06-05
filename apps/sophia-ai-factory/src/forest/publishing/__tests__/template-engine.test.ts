/**
 * Tests for template-engine.ts — renderTemplate + getEffectiveCaption/Title/Hashtags.
 * Uses FakeD1 backed by better-sqlite3.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderTemplate, getEffectiveCaption, getEffectiveTitle, getEffectiveHashtags } from '../template-engine';
import { set } from '@/seed/tenant-settings/registry';
import { createFakeD1 } from './fake-d1-sqlite';
import type { D1Database } from '@cloudflare/workers-types';

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

const TENANT = 'tenant-tpl-test';

describe('renderTemplate', () => {
  it('substitutes known vars', () => {
    const result = renderTemplate(
      'Check out {productName} — earn {commission}%! {ctaUrl}',
      { productName: 'Acme Widget', commission: '15', ctaUrl: 'https://acme.io' },
    );
    expect(result).toBe('Check out Acme Widget — earn 15%! https://acme.io');
  });

  it('leaves unknown vars as-is (does not silently blank them)', () => {
    const result = renderTemplate('Hello {name} from {unknownVar}', { name: 'Alice' });
    expect(result).toBe('Hello Alice from {unknownVar}');
  });

  it('handles empty vars object', () => {
    const result = renderTemplate('No vars here', {});
    expect(result).toBe('No vars here');
  });

  it('handles multiple identical placeholders', () => {
    const result = renderTemplate('{productName} is great, buy {productName}', { productName: 'Widget' });
    expect(result).toBe('Widget is great, buy Widget');
  });
});

describe('getEffectiveCaption', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeDb();
  });

  it('returns fallbackAI when preferTemplateOverAI is false (default)', async () => {
    const caption = await getEffectiveCaption(db, TENANT, 'youtube', 'AI generated caption', {});
    expect(caption).toBe('AI generated caption');
  });

  it('returns rendered template when preferTemplateOverAI is true and template exists', async () => {
    await set(db, TENANT, 'channels', {
      defaultPlatforms: [],
      templates: { youtube: { captionTemplate: 'Buy {productName} now! {ctaUrl}' } },
      preferTemplateOverAI: true,
    });

    const caption = await getEffectiveCaption(db, TENANT, 'youtube', 'AI caption', {
      productName: 'SuperWidget',
      ctaUrl: 'https://link.io',
    });
    expect(caption).toBe('Buy SuperWidget now! https://link.io');
  });

  it('falls back to AI when template is set but channel has no captionTemplate', async () => {
    await set(db, TENANT, 'channels', {
      defaultPlatforms: [],
      templates: { youtube: { titleTemplate: 'Only title' } },
      preferTemplateOverAI: true,
    });

    const caption = await getEffectiveCaption(db, TENANT, 'youtube', 'AI fallback', {});
    expect(caption).toBe('AI fallback');
  });

  it('falls back to AI when preferTemplateOverAI is true but no template for channel', async () => {
    await set(db, TENANT, 'channels', {
      defaultPlatforms: [],
      templates: {},
      preferTemplateOverAI: true,
    });

    const caption = await getEffectiveCaption(db, TENANT, 'tiktok', 'AI caption for tiktok', {});
    expect(caption).toBe('AI caption for tiktok');
  });
});

describe('getEffectiveTitle', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeDb();
  });

  it('returns rendered title template when enabled', async () => {
    await set(db, TENANT, 'channels', {
      defaultPlatforms: [],
      templates: { linkedin: { titleTemplate: '{productName} — {commission}% commission' } },
      preferTemplateOverAI: true,
    });

    const title = await getEffectiveTitle(db, TENANT, 'linkedin', 'AI title', {
      productName: 'Pro Tool',
      commission: '20',
    });
    expect(title).toBe('Pro Tool — 20% commission');
  });
});

describe('getEffectiveHashtags', () => {
  let db: D1Database;

  beforeEach(() => {
    db = makeDb();
  });

  it('returns rendered hashtags template', async () => {
    await set(db, TENANT, 'channels', {
      defaultPlatforms: [],
      templates: { instagram: { hashtagsTemplate: '#affiliate #{network} #{productName}' } },
      preferTemplateOverAI: true,
    });

    const tags = await getEffectiveHashtags(db, TENANT, 'instagram', '#fallback', {
      network: 'ShareASale',
      productName: 'Camera',
    });
    expect(tags).toBe('#affiliate #ShareASale #Camera');
  });
});
