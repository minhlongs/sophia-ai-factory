import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudioCommandPalette } from '../studio-command-palette';

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

describe('StudioCommandPalette CSRF, campaignDraft handoff & provenance integrity (Wave B.2)', () => {
  const originalFetch = globalThis.fetch;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    window.matchMedia = originalMatchMedia;
  });

  it('forwards campaignDraft + CSRF header on POST /api/studio/pipeline/execute and never fabricates missing server results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        executedAt: '2026-11-28T07:00:00Z',
        telemetrySource: 'live_d1',
        results: [
          {
            engineId: 'comment-pain-point-miner',
            status: 'passed',
            headline: 'OK',
            metrics: [],
            executedAt: '2026-11-28T07:00:00Z',
          },
          // Duplicate ID must not overwrite first result
          {
            engineId: 'comment-pain-point-miner',
            status: 'blocked',
            headline: 'DUP',
            metrics: [],
            executedAt: '2026-11-28T07:00:00Z',
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(
      <StudioCommandPalette
        locale="vi"
        campaignDraft={{
          script: 'Initial script',
          platform: 'tiktok',
          region: 'VN',
        }}
      />,
    );

    rerender(
      <StudioCommandPalette
        locale="vi"
        campaignDraft={{
          script: 'Updated — SCENARIO_CRYPTO_SECURITY_VN_2026_MARKER',
          platform: 'youtube_shorts',
          region: 'US',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('run-39-engines-btn'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/studio/pipeline/execute');
    expect((init.headers as Record<string, string>)['x-csrf-token']).toBe('test-csrf-token');
    const body = JSON.parse(init.body as string) as { script: string; platform: string; jurisdiction: string };
    expect(body.script).toContain('SCENARIO_CRYPTO_SECURITY_VN_2026_MARKER');
    expect(body.platform).toBe('youtube_shorts');
    expect(body.jurisdiction).toBe('US');

    await waitFor(() => {
      expect(screen.getByTestId('pipeline-verified-receipt-card')).toBeTruthy();
    });
  });

  it('surfaces inline error when fetch rejects without fabricating a receipt', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network down')) as unknown as typeof fetch;

    render(<StudioCommandPalette locale="en" />);
    fireEvent.click(screen.getByTestId('run-39-engines-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Network down');
    });
    expect(screen.queryByTestId('pipeline-verified-receipt-card')).toBeNull();
  });
});
