/**
 * Integration tests for Social RNN Phase 4 — Channel UI.
 *
 * Validates: migration schema, i18n keys, file existence.
 * (Component rendering tested via build + existing vitest suite.)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, '../..');
const MIGRATION = path.join(APP_ROOT, 'migrations', '0223-social-rnn.sql');
const EN_JSON = path.join(APP_ROOT, 'messages', 'en.json');
const VI_JSON = path.join(APP_ROOT, 'messages', 'vi.json');

// ── 1. Migration schema ───────────────────────────────────────────────────────

describe('Migration 0223-social-rnn.sql', () => {
  it('migration file exists', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true);
  });

  const sql = fs.readFileSync(MIGRATION, 'utf8');

  it('creates engagement_metrics table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS engagement_metrics');
    expect(sql).toContain('channel TEXT NOT NULL');
    expect(sql).toContain('hour_of_day INTEGER NOT NULL');
    expect(sql).toContain('avg_engagement REAL DEFAULT 0.0');
  });

  it('creates social_channels table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS social_channels');
    expect(sql).toContain('user_id TEXT NOT NULL');
    expect(sql).toContain("provider TEXT NOT NULL CHECK(provider IN ('youtube'");
    expect(sql).toContain("status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active'");
    expect(sql).toContain('followers_count INTEGER DEFAULT 0');
  });

  it('creates publish_events table', () => {
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS publish_events');
    expect(sql).toContain('user_id TEXT NOT NULL');
    expect(sql).toContain("status TEXT NOT NULL DEFAULT 'scheduled'");
    expect(sql).toContain('content_title TEXT');
    expect(sql).toContain('scheduled_at INTEGER');
    expect(sql).toContain('published_at INTEGER');
    expect(sql).toContain('views INTEGER DEFAULT 0');
    expect(sql).toContain('likes INTEGER DEFAULT 0');
    expect(sql).toContain('shares INTEGER DEFAULT 0');
  });

  it('creates required indexes', () => {
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_engagement_metrics_channel_hour');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_social_channels_user_provider');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_publish_events_user');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_publish_events_provider');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_publish_events_status');
  });
});

// ── 2. i18n keys ──────────────────────────────────────────────────────────────

describe('i18n socialPages namespace', () => {
  const en = JSON.parse(fs.readFileSync(EN_JSON, 'utf8'));
  const viData = JSON.parse(fs.readFileSync(VI_JSON, 'utf8'));

  it('socialPages exists in en.json', () => {
    expect(en.socialPages).toBeDefined();
  });

  it('socialPages exists in vi.json', () => {
    expect(viData.socialPages).toBeDefined();
  });

  it('has channels, calendar, history, metrics sub-namespaces', () => {
    for (const key of ['channels', 'calendar', 'history', 'metrics']) {
      expect(en.socialPages[key]).toBeDefined();
      expect(viData.socialPages[key]).toBeDefined();
    }
  });

  it('sidebar social entry is bilingual', () => {
    expect(en.dashboard?.sidebar?.social).toBe('Social Channels');
    expect(viData.dashboard?.sidebar?.social).toBe('Mạng Xã Hội');
  });
});

// ── 3. File existence ─────────────────────────────────────────────────────────

describe('Phase 4 files exist', () => {
  const files = [
    'src/components/social/channel-card.tsx',
    'src/components/social/calendar-grid.tsx',
    'src/components/social/metrics-chart.tsx',
    'src/app/[locale]/dashboard/social/channels/page.tsx',
    'src/app/[locale]/dashboard/social/channels/channels-client.tsx',
    'src/app/[locale]/dashboard/social/calendar/page.tsx',
    'src/app/[locale]/dashboard/social/calendar/calendar-client.tsx',
    'src/app/[locale]/dashboard/social/history/page.tsx',
    'src/app/[locale]/dashboard/social/history/history-client.tsx',
    'src/app/[locale]/dashboard/social/metrics/page.tsx',
    'src/app/[locale]/dashboard/social/metrics/metrics-client.tsx',
    'src/app/api/social/metrics/route.ts',
    'src/app/api/social/publish/route.ts',
    'src/app/api/social/channels/route.ts',
    'migrations/0223-social-rnn.sql',
  ];

  for (const file of files) {
    it(`${file} exists`, () => {
      expect(fs.existsSync(path.join(APP_ROOT, file))).toBe(true);
    });
  }
});
