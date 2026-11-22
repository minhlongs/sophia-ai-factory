/**
 * Unit tests for First-Value Journey UI components (Track B1.1):
 * - FirstValueByokCard
 * - FirstValueReviewPanel
 * - FirstValueJourneyClient
 */

import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { HonestValidationReceipt } from '@/tree/byok/honest-validation-receipt';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf' }),
}));

import { FirstValueByokCard } from '../first-value-byok-card';
import { FirstValueReviewPanel } from '../first-value-review-panel';
import { FirstValueJourneyClient } from '../first-value-journey-client';
import { FirstValuePostSchema } from '@/land/first-value/first-value-http-schemas';

const SAMPLE_RECEIPT: HonestValidationReceipt = {
  receiptId: 'rcpt_test_1',
  userId: 'user_1',
  orgId: 'org_1',
  provider: 'openrouter',
  maskedKey: 'sk-or-***1234',
  checkedAtUnix: 1700000000,
  capabilities: ['json_schema', 'tool_call'],
  budget: {
    monthlyBudgetUsd: null,
    monthSpentUsd: 0,
    cooldownUntil: null,
  },
  verdict: { outcome: 'no_cap_set' },
  policyStatus: 'absent',
  keyFormatAccepted: true,
  keyStoredSecurely: true,
  providerAuthStatus: 'untested',
  capabilitiesKnown: 'inferred_from_provider_table',
  costBasis: 'unavailable',
  paidInferenceExecuted: false,
  receiptIntegrity: {
    algorithm: 'hmac-sha256',
    signature: 'a'.repeat(64),
  },
};

function makeReview(
  state: 'pending_review' | 'accepted' | 'rejected' = 'pending_review',
): DurableFirstValueReview {
  return {
    artifactId: 'art_1',
    orgId: 'org_1',
    userId: 'user_1',
    missionId: 'mission_org_1_b1',
    idempotencyKey: 'idem_1',
    payloadHash: 'h'.repeat(64),
    reviewState: state,
    version: state === 'pending_review' ? 1 : 2,
    provenance: 'fixture_simulated',
    provenanceLabel: 'SIMULATED_FIXTURE_NOT_LIVE_AI_INFERENCE',
    topic: 'Sample topic',
    audience: 'Founders',
    durationSec: 30,
    publicPublished: false,
    mcuCharged: 0,
    mcuAccountingRef: 'fixture:zero_mcu',
    privateArtifactRef: 'private://org_1/first-value/art_1',
    receiptId: 'rcpt_test_1',
    script: {
      title: 'Sample Fixture Script',
      total_duration: 30,
      scenes: [
        {
          scene_number: 1,
          visual_description: 'Founder at desk',
          narration: 'Welcome to Sophia',
          duration_estimate: 10,
        },
      ],
    },
    acceptedAtIso: state === 'accepted' ? '2026-11-22T00:00:00.000Z' : null,
    acceptedByUserId: state === 'accepted' ? 'user_1' : null,
    rejectedAtIso: state === 'rejected' ? '2026-11-22T00:00:00.000Z' : null,
    rejectionReason: state === 'rejected' ? 'Needs revision' : null,
    createdAtIso: '2026-11-22T00:00:00.000Z',
    updatedAtIso: '2026-11-22T00:00:00.000Z',
  };
}

describe('FirstValueByokCard', () => {
  afterEach(() => cleanup());

  it('renders receipt details when BYOK is configured', () => {
    render(<FirstValueByokCard byokConfigured receipt={SAMPLE_RECEIPT} />);
    expect(screen.getByText('openrouter')).toBeTruthy();
    expect(screen.getByText('untested')).toBeTruthy();
    expect(screen.getByText('rcpt_test_1')).toBeTruthy();
  });

  it('renders setup wizard CTA when BYOK is not configured', () => {
    render(<FirstValueByokCard byokConfigured={false} receipt={null} />);
    expect(screen.getByText('byokUnavailable')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'openSetupWizard' }).getAttribute('href')).toBe(
      '/dashboard/setup',
    );
  });
});

describe('FirstValueReviewPanel', () => {
  afterEach(() => cleanup());

  it('renders empty placeholder when no review is active', () => {
    render(
      <FirstValueReviewPanel
        review={null}
        busy={false}
        exportPayload={null}
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onExport={vi.fn()}
      />,
    );
    expect(screen.getByText('reviewEmpty')).toBeTruthy();
  });

  it('allows Accept and Reject on pending_review and keeps export locked', async () => {
    const onAccept = vi.fn(async () => {});
    const onReject = vi.fn(async () => {});
    render(
      <FirstValueReviewPanel
        review={makeReview('pending_review')}
        busy={false}
        exportPayload={null}
        onAccept={onAccept}
        onReject={onReject}
        onExport={vi.fn()}
      />,
    );

    expect(screen.getByText('Sample Fixture Script')).toBeTruthy();
    expect(screen.getByText('exportLocked')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('rejectReasonPlaceholder'), {
      target: { value: 'Too generic' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'acceptBtn' }));
    fireEvent.click(screen.getByRole('button', { name: 'rejectBtn' }));

    await waitFor(() => {
      expect(onAccept).toHaveBeenCalledTimes(1);
      expect(onReject).toHaveBeenCalledWith('Too generic');
    });
  });

  it('unlocks export buttons and renders exportPayload when accepted', async () => {
    const onExport = vi.fn(async () => {});
    render(
      <FirstValueReviewPanel
        review={makeReview('accepted')}
        busy={false}
        exportPayload="# Exported Markdown"
        onAccept={vi.fn()}
        onReject={vi.fn()}
        onExport={onExport}
      />,
    );

    expect(screen.getByText('finalizedNotice')).toBeTruthy();
    expect(screen.getByText('# Exported Markdown')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'exportJsonBtn' }));
    fireEvent.click(screen.getByRole('button', { name: 'exportMarkdownBtn' }));

    await waitFor(() => {
      expect(onExport).toHaveBeenCalledWith('json');
      expect(onExport).toHaveBeenCalledWith('markdown');
    });
  });
});

describe('FirstValueJourneyClient', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('runs status load, cost preview (available & unavailable), create, accept, export, and error handling', async () => {
    const pendingReview = makeReview('pending_review');
    const acceptedReview = makeReview('accepted');

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          byokConfigured: true,
          configuredProviders: ['openrouter'],
          receipt: SAMPLE_RECEIPT,
          recentReviews: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preview: {
            status: 'COST_ESTIMATE_AVAILABLE',
            estimatedCostRangeUsd: { minUsd: 0.001, maxUsd: 0.002 },
            priceSource: 'openrouter:catalog',
            priceUpdatedAt: '2026-11-22T00:00:00.000Z',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          preview: {
            status: 'COST_ESTIMATE_UNAVAILABLE',
            estimatedCostRangeUsd: null,
            priceSource: 'unpriced',
            priceUpdatedAt: '2026-11-22T00:00:00.000Z',
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ review: pendingReview }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ review: acceptedReview }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ export: { content: { artifactId: 'art_1' } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ export: { content: '# Markdown Export' } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ error: 'Conflict error' }),
      });

    render(<FirstValueJourneyClient orgId="org_1" />);

    await waitFor(() => {
      expect(screen.getByText('rcpt_test_1')).toBeTruthy();
    });

    // Update form inputs
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[0], { target: { value: 'Updated topic' } });
    fireEvent.change(inputs[1], { target: { value: 'Updated audience' } });
    fireEvent.change(inputs[2], { target: { value: 'openai/gpt-4o-mini' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '45' } });

    // Available cost preview
    fireEvent.click(screen.getByRole('button', { name: 'previewCostBtn' }));
    await waitFor(() => {
      expect(screen.getByText('openrouter:catalog')).toBeTruthy();
    });

    // Unavailable cost preview
    fireEvent.change(inputs[2], { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'previewCostBtn' }));
    await waitFor(() => {
      expect(screen.getByText(/COST_ESTIMATE_UNAVAILABLE/)).toBeTruthy();
    });

    // Create review
    fireEvent.click(screen.getByRole('button', { name: 'createReviewBtn' }));
    await waitFor(() => {
      expect(screen.getByText('Sample Fixture Script')).toBeTruthy();
    });

    // Accept review
    fireEvent.click(screen.getByRole('button', { name: 'acceptBtn' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'exportJsonBtn' })).toBeTruthy();
    });

    // Export JSON (object content)
    fireEvent.click(screen.getByRole('button', { name: 'exportJsonBtn' }));
    await waitFor(() => {
      expect(screen.getByText(/"artifactId": "art_1"/)).toBeTruthy();
    });

    // Export Markdown (string content)
    fireEvent.click(screen.getByRole('button', { name: 'exportMarkdownBtn' }));
    await waitFor(() => {
      expect(screen.getByText('# Markdown Export')).toBeTruthy();
    });

    // Error handling path
    fireEvent.click(screen.getByRole('button', { name: 'exportJsonBtn' }));
    await waitFor(() => {
      expect(screen.getByText(/Conflict error/)).toBeTruthy();
    });
  });

  it('handles reject_review with reason and skips status fetch when orgId is empty', async () => {
    const pendingReview = makeReview('pending_review');
    const rejectedReview = makeReview('rejected');

    const { unmount } = render(<FirstValueJourneyClient orgId="" />);
    expect(fetchMock).not.toHaveBeenCalled();
    unmount();

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          byokConfigured: true,
          configuredProviders: ['openrouter'],
          receipt: SAMPLE_RECEIPT,
          recentReviews: [pendingReview],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ review: rejectedReview }),
      });

    render(<FirstValueJourneyClient orgId="org_1" />);
    await waitFor(() => {
      expect(screen.getByText('Sample Fixture Script')).toBeTruthy();
    });

    fireEvent.change(screen.getByPlaceholderText('rejectReasonPlaceholder'), {
      target: { value: '  Needs sharper hook  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'rejectBtn' }));

    await waitFor(() => {
      expect(screen.getByText('rejected')).toBeTruthy();
    });
  });

  it('disables preview and create actions when topic is empty or whitespace-only and shows inline alert', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        byokConfigured: true,
        configuredProviders: ['openrouter'],
        receipt: SAMPLE_RECEIPT,
        recentReviews: [],
      }),
    });

    render(<FirstValueJourneyClient orgId="org_1" />);
    await waitFor(() => {
      expect(screen.getByText('rcpt_test_1')).toBeTruthy();
    });

    const inputs = screen.getAllByRole('textbox');
    const topicInput = inputs[0];
    const previewBtn = screen.getByRole('button', { name: 'previewCostBtn' }) as HTMLButtonElement;
    const createBtn = screen.getByRole('button', { name: 'createReviewBtn' }) as HTMLButtonElement;

    expect(previewBtn.disabled).toBe(false);
    expect(createBtn.disabled).toBe(false);

    // Clear to whitespace-only
    fireEvent.change(topicInput, { target: { value: '   ' } });

    expect(previewBtn.disabled).toBe(true);
    expect(createBtn.disabled).toBe(true);
    expect(topicInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('topicRequired');

    // Clicking disabled buttons must not issue any POST request
    fireEvent.click(previewBtn);
    fireEvent.click(createBtn);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Restoring a non-empty topic re-enables both actions
    fireEvent.change(topicInput, { target: { value: 'Valid topic' } });
    expect(previewBtn.disabled).toBe(false);
    expect(createBtn.disabled).toBe(false);
    expect(topicInput.getAttribute('aria-invalid')).toBe('false');

    // Clearing audience to whitespace-only also disables both actions
    const audienceInput = inputs[1];
    fireEvent.change(audienceInput, { target: { value: '   ' } });
    expect(previewBtn.disabled).toBe(true);
    expect(createBtn.disabled).toBe(true);
    expect(audienceInput.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('audienceRequired');
  });
});

describe('FirstValuePostSchema — server-side whitespace topic rejection', () => {
  it('rejects whitespace-only topic and audience on cost_preview, fixture_preview, and create_review', () => {
    const costRes = FirstValuePostSchema.safeParse({
      action: 'cost_preview',
      orgId: 'org_1',
      topic: '   ',
      audience: 'Founders',
    });
    expect(costRes.success).toBe(false);

    const fixtureRes = FirstValuePostSchema.safeParse({
      action: 'fixture_preview',
      orgId: 'org_1',
      topic: '   \t\n  ',
      audience: 'Founders',
    });
    expect(fixtureRes.success).toBe(false);

    const createRes = FirstValuePostSchema.safeParse({
      action: 'create_review',
      orgId: 'org_1',
      missionId: 'mission_1',
      topic: '   ',
      audience: 'Founders',
      receipt: SAMPLE_RECEIPT,
    });
    expect(createRes.success).toBe(false);

    const whitespaceAudienceRes = FirstValuePostSchema.safeParse({
      action: 'cost_preview',
      orgId: 'org_1',
      topic: 'Valid topic',
      audience: '   ',
    });
    expect(whitespaceAudienceRes.success).toBe(false);

    const validRes = FirstValuePostSchema.safeParse({
      action: 'cost_preview',
      orgId: 'org_1',
      topic: '  Valid topic  ',
      audience: '  Founders  ',
    });
    expect(validRes.success).toBe(true);
    if (validRes.success && validRes.data.action === 'cost_preview') {
      expect(validRes.data.topic).toBe('Valid topic');
      expect(validRes.data.audience).toBe('Founders');
    }
  });
});
