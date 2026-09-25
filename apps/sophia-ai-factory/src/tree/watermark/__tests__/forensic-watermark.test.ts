/**
 * Unit tests for Dynamic Forensic Watermarking Engine
 */

import { describe, it, expect } from 'vitest';
import {
  generateForensicWatermark,
  generateForensicWatermarkText,
  computeForensicHash,
  verifyForensicWatermark,
  DEFAULT_FORENSIC_OPACITY,
  DEFAULT_FORENSIC_POSITION,
} from '../forensic-watermark';

describe('forensic-watermark (Dynamic Forensic Watermarking Engine)', () => {
  const tenantId = 'tenant_apac_vietnam_001';
  const userId = 'usr_vip_enterprise_888';
  const customDate = new Date('2026-09-24T12:00:00Z');

  it('generates a complete watermark descriptor with default options', () => {
    const watermark = generateForensicWatermark(tenantId, userId, undefined, {
      date: customDate,
    });

    expect(watermark).toBeDefined();
    expect(typeof watermark.overlayText).toBe('string');
    expect(watermark.opacity).toBe(DEFAULT_FORENSIC_OPACITY);
    expect(watermark.position).toBe(DEFAULT_FORENSIC_POSITION);
    expect(watermark.forensicHash).toHaveLength(16);

    // Verify format: Sophia AI • Tenant: tenant_a • ID: <hash> • 2026-09-24
    expect(watermark.overlayText).toContain('Sophia AI');
    expect(watermark.overlayText).toContain('Tenant: tenant_a');
    expect(watermark.overlayText).toContain(`ID: ${watermark.forensicHash}`);
    expect(watermark.overlayText).toContain('2026-09-24');
  });

  it('embeds customText when provided', () => {
    const customText = 'Confidential Internal Preview';
    const watermark = generateForensicWatermark(tenantId, userId, customText, {
      date: customDate,
    });

    expect(watermark.overlayText).toContain('Confidential Internal Preview');
    expect(watermark.overlayText).toContain('Sophia AI • Confidential Internal Preview • Tenant:');
  });

  it('generateForensicWatermarkText returns matching overlayText', () => {
    const text = generateForensicWatermarkText(tenantId, userId);
    expect(text).toContain('Sophia AI');
    expect(text).toContain('Tenant:');
    expect(text).toContain('ID:');
  });

  it('computeForensicHash is deterministic', () => {
    const hash1 = computeForensicHash(tenantId, userId);
    const hash2 = computeForensicHash(tenantId, userId);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(16);
  });

  it('produces distinct hashes for different users within same tenant', () => {
    const hashA = computeForensicHash(tenantId, 'user_alice');
    const hashB = computeForensicHash(tenantId, 'user_bob');
    expect(hashA).not.toBe(hashB);
  });

  it('produces distinct hashes for same user across different tenants', () => {
    const hash1 = computeForensicHash('tenant_1', userId);
    const hash2 = computeForensicHash('tenant_2', userId);
    expect(hash1).not.toBe(hash2);
  });

  it('verifyForensicWatermark accurately validates watermark integrity', () => {
    const watermark = generateForensicWatermark(tenantId, userId);

    expect(verifyForensicWatermark(watermark.overlayText, tenantId, userId)).toBe(true);

    // Mismatched user
    expect(verifyForensicWatermark(watermark.overlayText, tenantId, 'user_impostor')).toBe(false);

    // Mismatched tenant
    expect(verifyForensicWatermark(watermark.overlayText, 'tenant_other', userId)).toBe(false);

    // Empty or malformed input
    expect(verifyForensicWatermark('', tenantId, userId)).toBe(false);
  });

  it('respects custom opacity and position overrides within bounds', () => {
    const wmCustom = generateForensicWatermark(tenantId, userId, undefined, {
      opacity: 0.4,
      position: 'top-right',
    });
    expect(wmCustom.opacity).toBe(0.4);
    expect(wmCustom.position).toBe('top-right');

    // Clamps out-of-range opacity
    const wmClampedLow = generateForensicWatermark(tenantId, userId, undefined, {
      opacity: 0.01,
    });
    expect(wmClampedLow.opacity).toBe(0.05);

    const wmClampedHigh = generateForensicWatermark(tenantId, userId, undefined, {
      opacity: 1.5,
    });
    expect(wmClampedHigh.opacity).toBe(1.0);
  });

  it('handles empty string tenantId and userId safely with fallbacks', () => {
    const wm = generateForensicWatermark('', '');
    expect(wm.overlayText).toContain('Sophia AI');
    expect(wm.forensicHash).toHaveLength(16);
  });
});
