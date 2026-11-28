import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudioCommandPalette } from '../studio-command-palette';
import { regionToCountry, regionToJurisdiction } from '../opc-commander-roe-bar';
import { formatReceiptClipboardText } from '@/seed/ui/pipeline-stage-manifest';

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

describe('StudioCommandPalette CSRF, empty-script guard, provenance & partial receipt (PR #357)', () => {
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

  it('maps regions to jurisdictions and countries without invalid EU country or US-for-SG substitution', () => {
    expect(regionToJurisdiction('VN')).toBe('VN');
    expect(regionToJurisdiction('US')).toBe('US');
    expect(regionToJurisdiction('EU')).toBe('EU');
    expect(regionToJurisdiction('UK')).toBe('UK');
    expect(regionToJurisdiction('SG')).toBe('GLOBAL');
    expect(regionToCountry('EU')).toBeUndefined();
    expect(regionToCountry('VN')).toBe('VN');
    expect(regionToCountry('SG')).toBe('SG');

    const partialClipboardVi = formatReceiptClipboardText(
      {
        executedAt: '2026-11-28T07:00:00Z',
        telemetrySource: 'live_d1',
        totalEngines: 39,
        passedCount: 1,
        warningCount: 0,
        blockedCount: 0,
        totalComputeMs: 1.2,
        subIdWatermark: 'Not evaluated',
        waterfallSplit: 'Not evaluated',
        reconciliationVerdict: 'Not evaluated',
      },
      'vi',
    );
    expect(partialClipboardVi).toContain('BIÊN NHẬN CHƯA ĐẦY ĐỦ (1/39 ĐỘNG CƠ)');
    const partialClipboardEn = formatReceiptClipboardText(
      {
        executedAt: '2026-11-28T07:00:00Z',
        telemetrySource: 'default_sample',
        totalEngines: 39,
        passedCount: 1,
        warningCount: 0,
        blockedCount: 0,
        totalComputeMs: 1.2,
        subIdWatermark: 'Not evaluated',
        waterfallSplit: 'Not evaluated',
        reconciliationVerdict: 'Not evaluated',
      },
      'en',
    );
    expect(partialClipboardEn).toContain('INCOMPLETE PIPELINE RECEIPT (1/39 ENGINES)');
  });

  it('rejects generic platform or GLOBAL jurisdiction without silent substitution', () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <StudioCommandPalette
        locale="vi"
        campaignDraft={{
          script: 'Valid script',
          platform: 'generic',
          region: 'GLOBAL',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('run-39-engines-btn'));
    expect(screen.getByRole('alert').textContent).toContain('nền tảng cụ thể');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects empty or whitespace-only campaign script without sending a sample request', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <StudioCommandPalette
        locale="vi"
        campaignDraft={{
          script: '   ',
          platform: 'facebook_reels',
          region: 'EU',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('run-39-engines-btn'));
    expect(screen.getByRole('alert').textContent).toContain('kịch bản');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards exact facebook_reels/EU + CSRF header and marks 1/39 partial response as incomplete without fabricated financial defaults', async () => {
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
            state: 'passed',
            metricOutput: '3 pain points',
            detail: { vi: '3 nỗi đau', en: '3 pain points' },
            durationMs: 1.2,
          },
        ],
      }),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <StudioCommandPalette
        locale="vi"
        campaignDraft={{
          script: 'Updated — SCENARIO_CRYPTO_SECURITY_VN_2026_MARKER',
          platform: 'facebook_reels',
          region: 'EU',
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
    const body = JSON.parse(init.body as string) as { script: string; platform: string; jurisdiction: string; country?: string };
    expect(body.script).toContain('SCENARIO_CRYPTO_SECURITY_VN_2026_MARKER');
    expect(body.platform).toBe('facebook_reels');
    expect(body.jurisdiction).toBe('EU');
    expect(body.country).toBeUndefined();

    await waitFor(() => {
      const card = screen.getByTestId('pipeline-verified-receipt-card');
      expect(card.textContent).toContain('BIÊN NHẬN CHƯA ĐẦY ĐỦ (1/39 ĐỘNG CƠ)');
      expect(card.textContent).not.toContain('39/39');
      expect(card.textContent).not.toContain('3-Way Balanced');
      expect(card.textContent).not.toContain('HMAC-SHA256');
    });
  });

  it('rejects duplicate or unknown engine IDs from server without rendering a verified receipt', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        executedAt: '2026-11-28T07:00:00Z',
        telemetrySource: 'live_d1',
        results: [
          { engineId: 'comment-pain-point-miner', state: 'passed', metricOutput: 'OK', durationMs: 1.0 },
          { engineId: 'comment-pain-point-miner', state: 'passed', metricOutput: 'DUP', durationMs: 1.0 },
        ],
      }),
    }) as unknown as typeof fetch;

    render(<StudioCommandPalette locale="en" />);
    fireEvent.click(screen.getByTestId('run-39-engines-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('duplicate, unknown, or malformed');
    });
    expect(screen.queryByTestId('pipeline-verified-receipt-card')).toBeNull();
  });

  it('surfaces inline error on HTTP 500 without fabricating a receipt', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ ok: false, error: 'Server error' }),
    }) as unknown as typeof fetch;

    render(<StudioCommandPalette locale="vi" />);
    fireEvent.click(screen.getByTestId('run-39-engines-btn'));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Server error');
    });
    expect(screen.queryByTestId('pipeline-verified-receipt-card')).toBeNull();
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

  it('rejects empty script in English locale and allows explicit local sample check', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(
      <StudioCommandPalette
        locale="en"
        campaignDraft={{
          script: '',
          platform: 'tiktok',
          region: 'VN',
        }}
      />,
    );

    fireEvent.click(screen.getByTestId('run-39-engines-btn'));
    expect(screen.getByRole('alert').textContent).toContain('campaign script');
    expect(fetchMock).not.toHaveBeenCalled();

    // Explicit local sample mode executes browser simulation with 39/39 sample receipt
    const localBtn = screen.getByRole('button', { name: /Run Local Browser Check/i });
    fireEvent.click(localBtn);
    await waitFor(() => {
      expect(screen.getByTestId('pipeline-verified-receipt-card')).toBeTruthy();
    });
  });
});
