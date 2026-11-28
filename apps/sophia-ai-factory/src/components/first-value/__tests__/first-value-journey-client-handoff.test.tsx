import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../../../messages/vi.json';
import { FirstValueJourneyClient } from '../first-value-journey-client';
import type { PreviewHandoffSnapshot } from '../zero-key-preview-studio';

let capturedOnUpgrade: ((snapshot: PreviewHandoffSnapshot) => void) | undefined;

vi.mock('@/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

vi.mock('../zero-key-preview-studio', () => ({
  ZeroKeyPreviewStudio: ({
    orgId,
    onUpgradeToByok,
  }: {
    orgId: string;
    onUpgradeToByok?: (snapshot: PreviewHandoffSnapshot) => void;
  }) => {
    capturedOnUpgrade = onUpgradeToByok;
    return <div data-testid="mock-zero-key-preview" data-org-id={orgId} />;
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('FirstValueJourneyClient Preview-to-BYOK handoff & stale cost protection (Wave C.3)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnUpgrade = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('transfers exact brief + script, verifies cost_preview payload, rejects wrong-org snapshot, cancels cleanly, and discards stale cost response', async () => {
    const staleCostResp = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    const postPayloads: Array<Record<string, unknown>> = [];

    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as Record<string, unknown>;
        postPayloads.push(body);
        if (postPayloads.length === 1) {
          return staleCostResp.promise;
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            preview: {
              pricingStatus: 'estimated',
              provider: 'openrouter',
              model: 'google/gemini-2-5-flash',
              estimatedUsd: 0.002,
              estimatedMcu: 0,
            },
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          orgId: 'org-a',
          configuredProviders: [],
          receipt: null,
          recentReviews: [],
          pilot: { liveInferenceEnabled: false },
        }),
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { rerender } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <FirstValueJourneyClient orgId="org-a" initialPilotMode={false} />
      </NextIntlClientProvider>,
    );

    await waitFor(() => expect(capturedOnUpgrade).toBeDefined());

    // 1. Wrong-workspace snapshot must be rejected
    act(() => {
      capturedOnUpgrade?.({
        orgId: 'org-other',
        topic: 'Wrong org',
        audience: 'Wrong',
        durationSec: 30,
        scriptText: 'Should never appear',
        revision: 1,
        provenance: 'USER_EDITED_SCRIPT',
        contentLanguage: 'vi',
      });
    });
    expect(screen.queryByTestId('preview-byok-handoff-banner')).toBeNull();

    // 2. Start cost_preview #1 (stale), then receive valid handoff for org-a before #1 resolves
    const costBtn = screen.getByRole('button', { name: /Xem dự toán chi phí/i });
    fireEvent.click(costBtn);

    act(() => {
      capturedOnUpgrade?.({
        orgId: 'org-a',
        topic: 'Bảo mật sàn crypto VN — C3_MARKER',
        audience: 'Người mới tìm hiểu tài sản số',
        durationSec: 45,
        scriptText: 'Bước 1: Kiểm tra 2FA.\nBước 2: Không cam kết lợi nhuận.',
        revision: 3,
        provenance: 'USER_EDITED_SCRIPT',
        contentLanguage: 'vi',
      });
    });

    // Resolve stale cost_preview #1 -> must be ignored
    await act(async () => {
      staleCostResp.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          preview: {
            pricingStatus: 'estimated',
            provider: 'openrouter',
            model: 'stale-model',
            estimatedUsd: 9.99,
            estimatedMcu: 99,
          },
        }),
      });
    });

    expect(screen.getByTestId('preview-byok-handoff-banner').textContent).toContain('KEY_NOT_CONFIGURED');
    expect(screen.getByTestId('preview-handoff-script-ref').textContent).toContain('Bước 1: Kiểm tra 2FA.');
    expect(screen.queryByText(/9\.99/)).toBeNull();

    // 3. Request cost_preview #2 -> verify actual POST payload carries transferred topic/audience/duration
    fireEvent.click(costBtn);
    await waitFor(() => expect(postPayloads.length).toBeGreaterThanOrEqual(2));
    const latestCostReq = postPayloads[postPayloads.length - 1];
    expect(latestCostReq.action).toBe('cost_preview');
    expect(latestCostReq.orgId).toBe('org-a');
    expect(latestCostReq.topic).toBe('Bảo mật sàn crypto VN — C3_MARKER');
    expect(latestCostReq.audience).toBe('Người mới tìm hiểu tài sản số');
    expect(latestCostReq.durationSec).toBe(45);

    // 4. Cancel handoff closes banner cleanly
    fireEvent.click(screen.getByTestId('preview-handoff-cancel-btn'));
    expect(screen.queryByTestId('preview-byok-handoff-banner')).toBeNull();

    // 5. Workspace orgId change clears any handoff state
    act(() => {
      capturedOnUpgrade?.({
        orgId: 'org-a',
        topic: 'T2',
        audience: 'A2',
        durationSec: 30,
        scriptText: 'Script 2',
        revision: 4,
        provenance: 'FIXTURE_SCRIPT',
        contentLanguage: 'vi',
      });
    });
    expect(screen.getByTestId('preview-byok-handoff-banner')).toBeTruthy();

    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <FirstValueJourneyClient orgId="org-b" initialPilotMode={false} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId('preview-byok-handoff-banner')).toBeNull();
  });
});
