/**
 * Tests for org branding repo — input validation, upsert logic, and the
 * tier-aware watermark builder.
 */

import { describe, it, expect, vi } from 'vitest';
import { buildWatermarkForTier, type OrgBrandingRow } from '../org-branding-repo';

const baseRow: OrgBrandingRow = {
  org_id: 'org-1',
  agency_name: 'Foo Agency',
  logo_url: 'https://cdn/logo.png',
  watermark_position: 'bottom-right',
  watermark_opacity: 0.85,
  watermark_policy: 'master_plus',
  primary_color: null,
  updated_at: 0,
  created_at: 0,
};

describe('buildWatermarkForTier', () => {
  it('returns null when policy = never', () => {
    expect(buildWatermarkForTier({ ...baseRow, watermark_policy: 'never' }, 'MASTER')).toBeNull();
  });

  it('returns null when no branding row at all', () => {
    expect(buildWatermarkForTier(null, 'MASTER')).toBeNull();
  });

  it('master_plus: MASTER tier gets agency logo', () => {
    const wm = buildWatermarkForTier(baseRow, 'MASTER');
    expect(wm).toMatchObject({
      text: 'Foo Agency',
      logoUrl: 'https://cdn/logo.png',
      position: 'bottom-right',
      opacity: 0.85,
    });
  });

  it('master_plus: ENTERPRISE tier also eligible', () => {
    const wm = buildWatermarkForTier(baseRow, 'ENTERPRISE');
    expect(wm?.text).toBe('Foo Agency');
  });

  it('master_plus: BASIC tier falls back to Sophia branding', () => {
    const wm = buildWatermarkForTier(baseRow, 'BASIC');
    expect(wm).toMatchObject({
      text: 'Sophia AI',
      position: 'bottom-right',
    });
    expect(wm?.logoUrl).toBeUndefined();
  });

  it('always: every tier sees agency logo', () => {
    const row = { ...baseRow, watermark_policy: 'always' as const };
    expect(buildWatermarkForTier(row, 'BASIC')?.text).toBe('Foo Agency');
    expect(buildWatermarkForTier(row, 'PREMIUM')?.text).toBe('Foo Agency');
  });

  it('returns null when policy = always but agency_name + logo both empty', () => {
    const row = {
      ...baseRow,
      watermark_policy: 'always' as const,
      agency_name: null,
      logo_url: null,
    };
    expect(buildWatermarkForTier(row, 'MASTER')).toBeNull();
  });
});
