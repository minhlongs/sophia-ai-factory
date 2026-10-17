/**
 * Unit tests for Open-Core -> Sophia Cloud Workspace Portability & Version Beacon
 *
 * @module tree/open-core/__tests__/open-core-funnel.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  exportWorkspaceBundle,
  importWorkspaceBundle,
} from '../workspace-portability';
import { checkUpstreamReleaseBeacon } from '../version-beacon';

describe('Workspace Portability (Self-Host -> Sophia Cloud)', () => {
  it('exports and imports a valid signed workspace bundle without losing fields', async () => {
    const bundle = await exportWorkspaceBundle({
      exportedAt: 1760000000,
      sourceEdition: 'community',
      defaultLocale: 'vi',
      routingStrategy: 'costOptimized',
      configuredProviders: ['openrouter', 'elevenlabs', 'heygen'],
      channelPresets: [
        { slug: 'ai-news-vn', niche: 'technology', locale: 'vi', cadencePerWeek: 5 },
      ],
    });

    expect(bundle.config.schemaVersion).toBe('sophia-workspace-v1');
    expect(bundle.checksumHex).toMatch(/^[0-9a-f]{64}$/);

    const imported = await importWorkspaceBundle(bundle);
    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.value.defaultLocale).toBe('vi');
      expect(imported.value.routingStrategy).toBe('costOptimized');
      expect(imported.value.configuredProviders).toEqual(['openrouter', 'elevenlabs', 'heygen']);
    }
  });

  it('rejects a bundle whose config was modified after export', async () => {
    const bundle = await exportWorkspaceBundle({
      exportedAt: 1760000000,
      sourceEdition: 'community',
      defaultLocale: 'en',
      routingStrategy: 'priority',
      configuredProviders: ['openrouter'],
      channelPresets: [],
    });

    const tampered = {
      ...bundle,
      config: { ...bundle.config, defaultLocale: 'vi' },
    };

    const res = await importWorkspaceBundle(tampered);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('CHECKSUM_MISMATCH');
    }
  });
});

describe('Privacy-Safe Version Beacon', () => {
  it('skips network calls when SOPHIA_DISABLE_VERSION_BEACON / disableBeacon is true', async () => {
    const report = await checkUpstreamReleaseBeacon({
      localShortSha: 'eaf9ed69',
      disableBeacon: true,
    });
    expect(report.checked).toBe(false);
    expect(report.updateAvailable).toBe(false);
  });

  it('detects when upstream Sophia Cloud has a newer release SHA', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ shortSha: '99887766' }), { status: 200 }),
    );

    const report = await checkUpstreamReleaseBeacon({
      localShortSha: 'eaf9ed69',
      disableBeacon: false,
      versionEndpointUrl: 'https://sophia.agencyos.network/api/version',
    });

    expect(report.checked).toBe(true);
    expect(report.upstreamShortSha).toBe('99887766');
    expect(report.updateAvailable).toBe(true);
    fetchSpy.mockRestore();
  });
});
