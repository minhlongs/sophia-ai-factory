/**
 * Tests for cross-channel-resolver — aggregates per ChannelProvider.
 *
 * Uses the global D1 mock from test/setup.tsx.
 * Verifies: all 14 channels present, zero-fill, zero-data handling, error recovery.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

function getD1Mock() {
  return ((globalThis as Record<string, unknown>).__env as Record<string, unknown>).DB as {
    prepare: ReturnType<typeof vi.fn>;
  };
}

function chainResult(results: unknown[]) {
  return {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results, success: true }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
  };
}

describe('resolveCrossChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getD1Mock().prepare.mockReturnValue(chainResult([]));
  });

  it('returns all 14 channels with zero values when no data', async () => {
    const { resolveCrossChannel } = await import('../cross-channel-resolver');
    const result = await resolveCrossChannel('ws_1');
    expect(result.hasData).toBe(false);
    expect(result.channels).toHaveLength(14);
    expect(result.channels[0].events).toBe(0);
    expect(result.channels[0].revenueCents).toBe(0);
  });

  it('returns hasData: false for empty workspaceId', async () => {
    const { resolveCrossChannel } = await import('../cross-channel-resolver');
    const result = await resolveCrossChannel('');
    expect(result.hasData).toBe(false);
    expect(result.workspaceId).toBe('');
  });

  it('aggregates ROI data for channels with events', async () => {
    getD1Mock().prepare.mockReturnValue(chainResult([
      {
        channel: 'youtube', events: 100, revenue_cents: 5000,
        cost_cents: 2000, roi: 2.5, projects: 3,
      },
      {
        channel: 'tiktok', events: 50, revenue_cents: 3000,
        cost_cents: 1500, roi: 2.0, projects: 2,
      },
    ]));

    const { resolveCrossChannel } = await import('../cross-channel-resolver');
    const result = await resolveCrossChannel('ws_1');
    expect(result.hasData).toBe(true);
    expect(result.totalEvents).toBe(150);
    expect(result.totalRevenueCents).toBe(8000);
    expect(result.totalCostCents).toBe(3500);

    const yt = result.channels.find(c => c.channel === 'youtube');
    expect(yt).toBeDefined();
    expect(yt!.events).toBe(100);
    expect(yt!.revenueCents).toBe(5000);

    const tk = result.channels.find(c => c.channel === 'tiktok');
    expect(tk).toBeDefined();
    expect(tk!.events).toBe(50);

    // Channels not in results get zero fill
    const ig = result.channels.find(c => c.channel === 'instagram');
    expect(ig).toBeDefined();
    expect(ig!.events).toBe(0);
  });

  it('includes all 14 ChannelProvider channels', async () => {
    const { resolveCrossChannel } = await import('../cross-channel-resolver');
    const result = await resolveCrossChannel('ws_1');
    const channelNames = result.channels.map(c => c.channel);
    expect(channelNames).toContain('tiktok');
    expect(channelNames).toContain('youtube');
    expect(channelNames).toContain('instagram');
    expect(channelNames).toContain('whatsapp');
    expect(channelNames).toContain('mastodon');
    expect(channelNames).toHaveLength(14);
  });

  it('returns hasData: false when D1 is unavailable', async () => {
    vi.doMock('@/seed/db/client', () => ({ getD1: () => null }));
    vi.resetModules();
    const { resolveCrossChannel } = await import('../cross-channel-resolver');
    const result = await resolveCrossChannel('ws_1');
    expect(result.hasData).toBe(false);
    vi.doUnmock('@/seed/db/client');
  });

  it('returns hasData: false when query throws', async () => {
    vi.resetModules();
    getD1Mock().prepare.mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockRejectedValue(new Error('D1 failure')),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true, meta: {} }),
    });

    const { resolveCrossChannel } = await import('../cross-channel-resolver');
    const result = await resolveCrossChannel('ws_1');
    expect(result.hasData).toBe(false);
    expect(result.channels).toHaveLength(14);
  });
});
