import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import viMessages from '../../../../messages/vi.json';
import { FirstValueJourneyClient } from '../first-value-journey-client';
import type { PreviewHandoffSnapshot } from '../zero-key-preview-studio';
import type { CostPreviewAvailable } from '@/seed/ai/cost/first-value-cost-preview';

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

function makeAvailableEstimate(minUsd: number, maxUsd: number, model: string): CostPreviewAvailable {
  return {
    status: 'COST_ESTIMATE_AVAILABLE',
    provider: 'openrouter',
    model,
    tokenAssumptions: { inputTokens: 320, outputTokensMin: 280, outputTokensMax: 560, durationSec: 35 },
    unitPricePer1MTokensUsd: { input: 0.15, output: 0.6 },
    priceSource: 'sophia-static-rate-card:src/seed/ai/cost/rate-card-table.ts',
    priceUpdatedAt: '2026-04-14T00:00:00.000Z',
    estimatedCostRangeUsd: { minUsd, maxUsd },
    fundingResponsibility: 'customer_byok',
    costBasis: 'estimated',
    promotionalCreditsExcluded: true,
    warnings: [],
  };
}

describe('FirstValueJourneyClient Preview-to-BYOK handoff, cost integrity & workspace isolation (PR #359)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnUpgrade = undefined;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('proves real CostPreviewAvailable positive/negative stale control, input invalidation, and full workspace reset on orgId change', async () => {
    const staleCostResp = deferred<{ ok: boolean; status: number; json: () => Promise<unknown> }>();
    const postPayloads: Array<Record<string, unknown>> = [];

    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
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
            preview: makeAvailableEstimate(0.0123, 0.0456, 'google/gemini-2-5-flash'),
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

    // 2. Start stale cost_preview #1 (9.1111–9.2222), then receive valid handoff for org-a before #1 resolves
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

    await act(async () => {
      staleCostResp.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          preview: makeAvailableEstimate(9.1111, 9.2222, 'stale-model'),
        }),
      });
    });

    // Stale estimate #1 MUST NOT appear
    expect(screen.queryByText(/9\.1111/)).toBeNull();
    expect(screen.getByTestId('preview-byok-handoff-banner').textContent).toContain('KEY_NOT_CONFIGURED');
    expect(screen.getByTestId('preview-handoff-script-ref').textContent).toContain('Bước 1: Kiểm tra 2FA.');

    // 3. Positive control: request cost_preview #2 -> real monetary range 0.0123–0.0456 MUST render
    fireEvent.click(costBtn);
    await waitFor(() => {
      expect(screen.getByText(/0\.0123/)).toBeTruthy();
      expect(screen.getByText(/0\.0456/)).toBeTruthy();
    });

    const latestCostReq = postPayloads[postPayloads.length - 1];
    expect(latestCostReq.action).toBe('cost_preview');
    expect(latestCostReq.orgId).toBe('org-a');
    expect(latestCostReq.topic).toBe('Bảo mật sàn crypto VN — C3_MARKER');
    expect(latestCostReq.audience).toBe('Người mới tìm hiểu tài sản số');
    expect(latestCostReq.durationSec).toBe(45);

    // 4. Editing duration, topic, audience, or model invalidates existing cost estimate
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
    const numberInput = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: '30' } });
    expect(screen.queryByText(/0\.0123/)).toBeNull();

    // Re-fetch estimate, then invalidate via model edit
    fireEvent.click(costBtn);
    await waitFor(() => expect(screen.getByText(/0\.0123/)).toBeTruthy());
    fireEvent.change(inputs[2], { target: { value: 'openai/gpt-4o-mini' } });
    expect(screen.queryByText(/0\.0123/)).toBeNull();

    // 5. Cancel handoff closes banner cleanly
    fireEvent.click(screen.getByTestId('preview-handoff-cancel-btn'));
    expect(screen.queryByTestId('preview-byok-handoff-banner')).toBeNull();

    // 6. Workspace orgId change resets imported topic, audience, duration AND handoff banner
    act(() => {
      capturedOnUpgrade?.({
        orgId: 'org-a',
        topic: 'ORG_A_SECRET_TOPIC',
        audience: 'ORG_A_SECRET_AUDIENCE',
        durationSec: 45,
        scriptText: 'ORG_A_SCRIPT',
        revision: 4,
        provenance: 'USER_EDITED_SCRIPT',
        contentLanguage: 'vi',
      });
    });
    expect(inputs[0].value).toBe('ORG_A_SECRET_TOPIC');

    rerender(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <FirstValueJourneyClient orgId="org-b" initialPilotMode={false} />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByTestId('preview-byok-handoff-banner')).toBeNull();
    expect(inputs[0].value).not.toBe('ORG_A_SECRET_TOPIC');
    expect(inputs[1].value).not.toBe('ORG_A_SECRET_AUDIENCE');
  });
});
