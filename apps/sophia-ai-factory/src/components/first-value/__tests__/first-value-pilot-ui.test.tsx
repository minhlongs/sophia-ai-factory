import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import type { PilotStatusSnapshot } from '@/seed/pilot/pilot-access-policy';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';

const mockSignOut = vi.fn(async () => {});

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    locale?: string;
    className?: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/seed/auth/better-auth-client', () => ({
  authClient: {
    signOut: () => mockSignOut(),
  },
}));

vi.mock('@/seed/security/use-csrf-token', () => ({
  getCsrfHeaders: () => ({ 'x-csrf-token': 'test-csrf-token' }),
}));

import { FirstValueByokCard } from '../first-value-byok-card';
import { FirstValuePilotBanner } from '../first-value-pilot-banner';
import { FirstValueFeedbackCard } from '../first-value-feedback-card';
import { FirstValueReviewPanel } from '../first-value-review-panel';
import { FirstValueSupportCard } from '../first-value-support-card';
import { PilotWorkspaceShell } from '../pilot-workspace-shell';
import { FirstValueJourneyClient } from '../first-value-journey-client';

function makePilotStatus(overrides: Partial<PilotStatusSnapshot> = {}): PilotStatusSnapshot {
  return {
    inviteOnly: true,
    liveInferenceEnabled: true,
    policyVersion: 'pilot-v1',
    consentAccepted: false,
    consentAcceptedAtIso: null,
    fundingMode: 'founder_sponsored',
    quota: {
      usedGenerations: 2,
      maxGenerations: 20,
      remainingGenerations: 18,
      lastGenerationAtIso: null,
    },
    ...overrides,
  };
}

function makeReview(state: 'pending_review' | 'accepted' = 'pending_review'): DurableFirstValueReview {
  return {
    artifactId: 'art_pilot_1',
    orgId: 'org_1',
    userId: 'u_1',
    missionId: 'mission_org_1_b1',
    idempotencyKey: 'idem_1',
    payloadHash: 'h'.repeat(64),
    reviewState: state,
    version: 1,
    provenance: 'live_provider',
    provenanceLabel: 'LIVE_PROVIDER_AI_INFERENCE',
    topic: 'Dental clinic launch',
    audience: 'Local families',
    durationSec: 30,
    publicPublished: false,
    mcuCharged: 0,
    mcuAccountingRef: 'pilot:founder_sponsored',
    privateArtifactRef: 'private://org_1/first-value/art_pilot_1',
    receiptId: 'pilot:founder_sponsored',
    script: {
      title: 'Initial Script Title',
      total_duration: 30,
      scenes: [
        {
          scene_number: 1,
          visual_description: 'Scene 1 visual',
          narration: 'Scene 1 narration',
          duration_estimate: 10,
        },
        {
          scene_number: 2,
          visual_description: 'Scene 2 visual',
          narration: 'Scene 2 narration',
          duration_estimate: 10,
        },
        {
          scene_number: 3,
          visual_description: 'Scene 3 visual',
          narration: 'Scene 3 narration',
          duration_estimate: 10,
        },
      ],
    },
    acceptedAtIso: state === 'accepted' ? '2026-11-23T00:00:00.000Z' : null,
    acceptedByUserId: state === 'accepted' ? 'u_1' : null,
    rejectedAtIso: null,
    rejectionReason: null,
    createdAtIso: '2026-11-23T00:00:00.000Z',
    updatedAtIso: '2026-11-23T00:00:00.000Z',
  };
}

describe('FirstValuePilotBanner', () => {
  afterEach(() => cleanup());

  it('requires checkbox before accepting pilot terms and renders funding variants', async () => {
    const onAcceptTerms = vi.fn(async () => {});
    const { rerender } = render(
      <FirstValuePilotBanner pilot={makePilotStatus()} busy={false} onAcceptTerms={onAcceptTerms} />,
    );

    expect(screen.getByText('pilotFundingSponsored')).toBeTruthy();
    const acceptBtn = screen.getByRole('button', { name: 'pilotConsentBtn' });
    expect((acceptBtn as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('checkbox'));
    expect((acceptBtn as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(acceptBtn);
    expect(onAcceptTerms).toHaveBeenCalledTimes(1);

    rerender(
      <FirstValuePilotBanner
        pilot={makePilotStatus({ fundingMode: 'customer_byok', consentAccepted: true })}
        busy={false}
        onAcceptTerms={onAcceptTerms}
      />,
    );
    expect(screen.getByText('pilotFundingByok')).toBeTruthy();
    expect(screen.getByText('pilotConsentAccepted')).toBeTruthy();

    rerender(
      <FirstValuePilotBanner
        pilot={makePilotStatus({ fundingMode: 'none', consentAccepted: false })}
        busy
        onAcceptTerms={onAcceptTerms}
      />,
    );
    expect(screen.getByText('pilotFundingNone')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'loading' })).toBeTruthy();
  });
});

describe('FirstValueFeedbackCard', () => {
  afterEach(() => cleanup());

  it('submits rating, category, and comment and resets after success', async () => {
    const onSubmitFeedback = vi.fn(async () => true);
    render(
      <FirstValueFeedbackCard
        busy={false}
        artifactId="art_pilot_1"
        onSubmitFeedback={onSubmitFeedback}
      />,
    );

    expect(screen.getByText(/art_pilot_1/)).toBeTruthy();
    const submitBtn = screen.getByRole('button', { name: 'feedbackSubmitBtn' });
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: '4' } });
    fireEvent.change(selects[1], { target: { value: 'editing_friction' } });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '  Great draft, minor tweak needed  ' } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledWith({
        rating: 4,
        category: 'editing_friction',
        comment: 'Great draft, minor tweak needed',
        screenshotDataUrl: null,
      });
      expect(screen.getByText('feedbackSubmittedSuccess')).toBeTruthy();
    });

    // Reject unsupported file type and oversized image, accept valid PNG
    const fileInput = screen.getByLabelText('feedbackScreenshotLabel') as HTMLInputElement;
    fireEvent.change(fileInput, {
      target: { files: [new File(['bad'], 'doc.pdf', { type: 'application/pdf' })] },
    });
    expect(screen.getByText('feedbackScreenshotInvalidType')).toBeTruthy();

    fireEvent.change(fileInput, {
      target: { files: [new File([new Uint8Array(600 * 1024)], 'big.png', { type: 'image/png' })] },
    });
    expect(screen.getByText('feedbackScreenshotTooLarge')).toBeTruthy();

    fireEvent.change(fileInput, {
      target: { files: [new File(['pngbytes'], 'bug.png', { type: 'image/png' })] },
    });
    await waitFor(() => {
      expect(screen.getByText('bug.png')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'feedbackScreenshotRemoveBtn' }));
    expect(screen.queryByText('bug.png')).toBeNull();

    fireEvent.change(textarea, { target: { value: 'Follow-up note' } });
    expect(screen.queryByText('feedbackSubmittedSuccess')).toBeNull();
  });

  it('shows loading state when busy and keeps text when submit returns false', async () => {
    const onSubmitFeedback = vi.fn(async () => false);
    const { rerender } = render(
      <FirstValueFeedbackCard
        busy={false}
        artifactId={null}
        onSubmitFeedback={onSubmitFeedback}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Issue details' } });
    fireEvent.click(screen.getByRole('button', { name: 'feedbackSubmitBtn' }));

    await waitFor(() => {
      expect(onSubmitFeedback).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText('feedbackSubmittedSuccess')).toBeNull();

    rerender(
      <FirstValueFeedbackCard busy artifactId={null} onSubmitFeedback={onSubmitFeedback} />,
    );
    expect(screen.getByRole('button', { name: 'loading' })).toBeTruthy();
  });
});

describe('FirstValueReviewPanel pilot edit & copy export', () => {
  afterEach(() => cleanup());

  it('supports inline editing, cancelling, saving, and copying exported script to clipboard', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const onEdit = vi.fn(async (_script: ScriptOutput) => true);
    const { rerender } = render(
      <FirstValueReviewPanel
        review={makeReview('pending_review')}
        busy={false}
        onAccept={vi.fn(async () => {})}
        onReject={vi.fn(async () => {})}
        onExport={vi.fn(async () => {})}
        onEdit={onEdit}
        exportPayload={null}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'editScriptBtn' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancelEditBtn' }));
    expect(screen.queryByRole('button', { name: 'saveEditsBtn' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'editScriptBtn' }));
    const titleInput = screen.getByDisplayValue('Initial Script Title');
    fireEvent.change(titleInput, { target: { value: 'Updated Pilot Title' } });
    const sceneTitleInputs = screen.getAllByPlaceholderText(/sceneHeading/);
    fireEvent.change(sceneTitleInputs[0]!, { target: { value: 'Scene 1 Custom Name' } });
    const narrationBox = screen.getByDisplayValue('Scene 1 narration');
    fireEvent.change(narrationBox, { target: { value: 'Updated Scene 1 narration' } });
    const visualBox = screen.getByDisplayValue('Scene 1 visual');
    fireEvent.change(visualBox, { target: { value: 'Updated Scene 1 visual' } });

    fireEvent.click(screen.getByRole('button', { name: 'saveEditsBtn' }));
    await waitFor(() => {
      expect(onEdit).toHaveBeenCalledTimes(1);
    });
    const savedArg = onEdit.mock.calls[0]?.[0];
    expect(savedArg).toBeDefined();
    expect(savedArg?.title).toBe('Updated Pilot Title');
    expect(savedArg?.scenes[0]?.title).toBe('Scene 1 Custom Name');
    expect(savedArg?.scenes[0]?.narration).toBe('Updated Scene 1 narration');
    expect(savedArg?.scenes[0]?.visual_description).toBe('Updated Scene 1 visual');
    expect(screen.getByText('draftSavedNotice')).toBeTruthy();

    const createObjectUrlSpy = vi.fn(() => 'blob:mock-pilot-export');
    const revokeObjectUrlSpy = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrlSpy,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrlSpy,
    });
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    const onExport = vi.fn(async () => {});
    rerender(
      <FirstValueReviewPanel
        review={makeReview('accepted')}
        busy={false}
        onAccept={vi.fn(async () => {})}
        onReject={vi.fn(async () => {})}
        onExport={onExport}
        onEdit={onEdit}
        exportPayload="# Updated Pilot Title"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'copyExportBtn' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('# Updated Pilot Title');
      expect(screen.getByRole('button', { name: 'copiedBtn' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'exportJsonBtn' }));
    await waitFor(() => expect(onExport).toHaveBeenCalledWith('json'));
    fireEvent.click(screen.getByRole('button', { name: 'downloadExportBtn' }));
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:mock-pilot-export');
    anchorClickSpy.mockRestore();
  });
});

describe('FirstValueByokCard Customer BYOK & standard modes', () => {
  afterEach(() => cleanup());

  it('saves, replaces, cancels, and clears OpenRouter BYOK key in Customer BYOK pilot mode', async () => {
    const onSavePilotKey = vi.fn(async () => true);
    const onClearPilotKey = vi.fn(async () => true);
    const { rerender } = render(
      <FirstValueByokCard
        byokConfigured={false}
        receipt={null}
        isCustomerByokPilot
        busy={false}
        onSavePilotKey={onSavePilotKey}
        onClearPilotKey={onClearPilotKey}
      />,
    );

    expect(screen.getByText('pilotByokMissingBadge')).toBeTruthy();
    const saveBtn = screen.getByRole('button', { name: 'pilotByokSaveBtn' }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);

    const keyInput = screen.getByPlaceholderText('pilotByokPlaceholder');
    fireEvent.change(keyInput, { target: { value: '  sk-or-v1-customer-pilot-key-1234567890  ' } });
    expect(saveBtn.disabled).toBe(false);
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSavePilotKey).toHaveBeenCalledWith('sk-or-v1-customer-pilot-key-1234567890');
      expect(screen.getByText('pilotByokSavedNotice')).toBeTruthy();
    });

    rerender(
      <FirstValueByokCard
        byokConfigured
        receipt={null}
        isCustomerByokPilot
        busy={false}
        onSavePilotKey={onSavePilotKey}
        onClearPilotKey={onClearPilotKey}
      />,
    );
    expect(screen.getByText('pilotByokReadyBadge')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'pilotByokReplaceBtn' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancelEditBtn' }));

    fireEvent.click(screen.getByRole('button', { name: 'pilotByokClearBtn' }));
    await waitFor(() => {
      expect(onClearPilotKey).toHaveBeenCalledTimes(1);
    });
  });

  it('renders standard receipt and Setup Wizard fallback when not in Customer BYOK pilot mode', () => {
    const { rerender } = render(<FirstValueByokCard byokConfigured={false} receipt={null} />);
    expect(screen.getByText('openSetupWizard')).toBeTruthy();

    rerender(
      <FirstValueByokCard
        byokConfigured
        receipt={{
          receiptId: 'rcpt_123',
          userId: 'u_1',
          orgId: 'org_1',
          provider: 'openrouter',
          maskedKey: 'sk-or-***1234',
          checkedAtUnix: 1700000000,
          capabilities: ['json_schema'],
          budget: { monthlyBudgetUsd: null, monthSpentUsd: 0, cooldownUntil: null },
          verdict: { outcome: 'no_cap_set' },
          policyStatus: 'absent',
          keyFormatAccepted: true,
          keyStoredSecurely: true,
          providerAuthStatus: 'verified',
          capabilitiesKnown: 'probed',
          costBasis: 'unavailable',
          paidInferenceExecuted: false,
          receiptIntegrity: { algorithm: 'hmac-sha256', signature: 'sig_123' },
        }}
      />,
    );
    expect(screen.getByText('rcpt_123')).toBeTruthy();
  });
});

describe('FirstValueSupportCard & PilotWorkspaceShell', () => {
  afterEach(() => cleanup());

  it('submits support/deletion requests, renders psr_ receipt, and lists existing requests', async () => {
    const onSubmitRequest = vi.fn(async () => ({
      requestId: 'psr_test-receipt-001',
      requestType: 'data_deletion' as const,
      status: 'open',
      submittedAtIso: '2026-11-24T00:00:00.000Z',
      slaHours: 72,
    }));

    render(
      <FirstValueSupportCard
        busy={false}
        requests={[
          {
            id: 'psr_prev-0001',
            requestType: 'support',
            subject: 'Earlier question',
            status: 'acknowledged',
            createdAtIso: '2026-11-23T00:00:00.000Z',
            updatedAtIso: '2026-11-23T01:00:00.000Z',
            resolvedAtIso: null,
          },
        ]}
        onSubmitRequest={onSubmitRequest}
      />,
    );

    expect(screen.getByText('psr_prev-0001')).toBeTruthy();
    const submitBtn = screen.getByRole('button', { name: 'supportSubmitBtn' }) as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'data_deletion' } });
    fireEvent.change(screen.getByPlaceholderText('supportSubjectPlaceholder'), {
      target: { value: '  Delete all my pilot data  ' },
    });
    fireEvent.change(screen.getByPlaceholderText('supportDetailsPlaceholder'), {
      target: { value: '  Please purge my BYOK key and drafts.  ' },
    });
    expect(submitBtn.disabled).toBe(false);
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitRequest).toHaveBeenCalledWith({
        requestType: 'data_deletion',
        subject: 'Delete all my pilot data',
        details: 'Please purge my BYOK key and drafts.',
      });
      expect(screen.getByText('psr_test-receipt-001')).toBeTruthy();
    });
  });

  it('renders distraction-free PilotWorkspaceShell in VI & EN and triggers signOut', async () => {
    const { rerender } = render(
      <PilotWorkspaceShell email="customer@example.test" isVi>
        <div>Pilot Child Content</div>
      </PilotWorkspaceShell>,
    );

    expect(screen.getByText('Private Beta')).toBeTruthy();
    expect(screen.getAllByText('Hỗ trợ & Xóa dữ liệu').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Affiliate Offers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Doanh thu & Hoa hồng').length).toBeGreaterThan(0);
    expect(screen.getByText('customer@example.test')).toBeTruthy();
    expect(screen.getByText('Pilot Child Content')).toBeTruthy();

    rerender(
      <PilotWorkspaceShell email="" isVi={false}>
        <div>Pilot EN Content</div>
      </PilotWorkspaceShell>,
    );
    expect(screen.getByText('Support & Deletion')).toBeTruthy();
    expect(screen.getAllByText('Revenue Analytics').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });
});

describe('FirstValueJourneyClient Customer BYOK Affiliate Campaign Studio flow', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('drives BYOK save -> consent -> add offer -> generate campaign -> edit -> approve -> export -> record performance -> support request -> BYOK clear over /api/first-value', async () => {
    let byokSaved = false;
    let consented = false;
    const offers: Array<{
      id: string;
      orgId: string;
      userId: string;
      vertical: 'crypto' | 'saas';
      productName: string;
      officialWebsiteUrl: string;
      referralUrl: string;
      commissionTerms: string;
      targetAudience: string;
      targetMarket: string;
      productInfoSource: string;
      status: 'active';
      createdAtIso: string;
      updatedAtIso: string;
    }> = [];
    const campaigns: Array<Record<string, unknown>> = [];
    const performanceEntries: Array<Record<string, unknown>> = [];

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') {
        return new Response(
          JSON.stringify({
            byokConfigured: byokSaved,
            configuredProviders: byokSaved ? ['openrouter'] : [],
            receipt: null,
            recentReviews: [],
            pilot: makePilotStatus({
              financingMode: 'CUSTOMER_BYOK',
              fundingMode: byokSaved ? 'customer_byok' : 'none',
              modelId: 'openai/gpt-4o-mini',
              byokKeyConfigured: byokSaved,
              consentAccepted: consented,
              supportRequests: [],
            }),
            affiliateStudio: {
              offers,
              campaigns,
              performanceEntries,
              revenue: {
                partnerFeedStatus: 'NOT_CONNECTED',
                connectedNetworks: [],
                totalCampaigns: campaigns.length,
                approvedCampaigns: campaigns.filter((c) => c.reviewState === 'approved').length,
                clicksCount: performanceEntries.length > 0 ? 42 : null,
                clicksSource: performanceEntries.length > 0 ? 'PARTNER_REPORTED' : 'NOT_CONNECTED',
                signupsCount: performanceEntries.length > 0 ? 5 : 0,
                qualifiedConversions: performanceEntries.length > 0 ? 2 : 0,
                pendingCommissionUsd: performanceEntries.length > 0 ? 30 : 0,
                confirmedCommissionUsd: performanceEntries.length > 0 ? 60 : 0,
                estimatedAiCostUsd: campaigns.length * 0.02,
                netRevenueUsd: performanceEntries.length > 0 ? 59.98 : 0,
                currency: 'USD',
                isMultiCurrency: false,
                domainBReconciliation: null,
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      const body = JSON.parse(String(init.body ?? '{}')) as Record<string, unknown>;
      if (body.action === 'save_byok_key') {
        byokSaved = true;
        return new Response(JSON.stringify({ byokConfigured: true }), { status: 200 });
      }
      if (body.action === 'clear_byok_key') {
        byokSaved = false;
        return new Response(JSON.stringify({ byokConfigured: false }), { status: 200 });
      }
      if (body.action === 'accept_pilot_terms') {
        consented = true;
        return new Response(JSON.stringify({ consent: { accepted: true } }), { status: 200 });
      }
      if (body.action === 'save_affiliate_offer') {
        const offer = {
          id: 'poff_live_1',
          orgId: 'org_pilot_1',
          userId: 'u_1',
          vertical: 'saas' as const,
          productName: String(body.productName),
          officialWebsiteUrl: String(body.officialWebsiteUrl),
          referralUrl: String(body.referralUrl),
          commissionTerms: String(body.commissionTerms),
          targetAudience: String(body.targetAudience),
          targetMarket: String(body.targetMarket),
          productInfoSource: String(body.productInfoSource),
          status: 'active' as const,
          createdAtIso: '2026-11-25T00:00:00Z',
          updatedAtIso: '2026-11-25T00:00:00Z',
        };
        offers.push(offer);
        return new Response(JSON.stringify({ offer }), { status: 201 });
      }
      if (body.action === 'generate_affiliate_campaign') {
        const camp = {
          id: 'pcmp_live_1',
          orgId: 'org_pilot_1',
          userId: 'u_1',
          offerId: 'poff_live_1',
          idempotencyKey: 'idem_c1',
          payloadHash: 'hash_c1',
          vertical: 'saas',
          campaignName: 'SEMrush SEO Agency Growth Campaign',
          referralUrl: 'https://www.semrush.com/?ref=ceo-partner-99',
          targetMarket: 'US',
          provenance: 'live_provider',
          provenanceLabel: 'LIVE_PROVIDER_INFERENCE',
          reviewState: 'pending_review',
          version: 1,
          estimatedAiCostMicroUsd: 20000,
          pack: {
            campaignTitle: 'SEMrush SEO Agency Growth Campaign',
            audienceAnalysis: 'SEO agencies need faster keyword audits.',
            valueProposition: 'Audit client sites in 10 minutes.',
            contentAngles: ['Agency audit speed', 'Client reporting clarity'],
            hook: 'Stop losing SEO retainers to slow audits.',
            callToAction: 'Start with SEMrush: https://www.semrush.com/?ref=ceo-partner-99',
            shortFormScript: {
              title: 'SEMrush 30s Breakdown',
              total_duration: 30,
              scenes: [
                { scene_number: 1, title: 'Hook', visual_description: 'Audit dashboard', narration: 'Hook narration', duration_estimate: 10 },
                { scene_number: 2, title: 'Demo', visual_description: 'Keyword gap', narration: 'Demo narration', duration_estimate: 10 },
                { scene_number: 3, title: 'CTA', visual_description: 'Partner link card', narration: 'CTA https://www.semrush.com/?ref=ceo-partner-99', duration_estimate: 10 },
              ],
            },
            socialPost: 'Try SEMrush via https://www.semrush.com/?ref=ceo-partner-99\n\n#ad | Affiliate link included.',
            affiliateDisclosure: '#ad | Affiliate link included.',
            referralUrl: 'https://www.semrush.com/?ref=ceo-partner-99',
          },
          createdAtIso: '2026-11-25T00:00:00Z',
          updatedAtIso: '2026-11-25T00:00:00Z',
        };
        campaigns.push(camp);
        return new Response(JSON.stringify({ campaign: camp }), { status: 201 });
      }
      if (body.action === 'edit_affiliate_campaign') {
        const pack = body.pack as { campaignTitle: string };
        campaigns[0] = { ...campaigns[0], campaignName: pack.campaignTitle, pack, version: 2 };
        return new Response(JSON.stringify({ campaign: campaigns[0] }), { status: 200 });
      }
      if (body.action === 'approve_affiliate_campaign') {
        campaigns[0] = { ...campaigns[0], reviewState: 'approved', version: 3 };
        return new Response(JSON.stringify({ campaign: campaigns[0] }), { status: 200 });
      }
      if (body.action === 'export_affiliate_campaign') {
        return new Response(
          JSON.stringify({
            export: {
              content: '# Exported Bundle\nVerified Referral Link: https://www.semrush.com/?ref=ceo-partner-99',
            },
          }),
          { status: 200 },
        );
      }
      if (body.action === 'record_partner_performance') {
        const entry = {
          id: 'pperf_1',
          externalRefId: body.externalRefId,
          reportSource: body.reportSource,
          reportPeriod: body.reportPeriod,
          confirmedCommissionCents: 6000,
          pendingCommissionCents: 3000,
          currency: 'USD',
        };
        performanceEntries.push(entry);
        return new Response(JSON.stringify({ performanceEntry: entry }), { status: 201 });
      }
      if (body.action === 'submit_support_request') {
        return new Response(
          JSON.stringify({
            acknowledgment: {
              requestId: 'psr_live-0001',
              requestType: body.requestType,
              status: 'open',
              submittedAtIso: '2026-11-24T00:00:00.000Z',
              slaHours: 72,
            },
          }),
          { status: 201 },
        );
      }
      return new Response(JSON.stringify({ error: 'unexpected' }), { status: 400 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FirstValueJourneyClient orgId="org_pilot_1" initialPilotMode />);

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4o-mini')).toBeTruthy();
    });

    // 1. Save BYOK key
    fireEvent.change(screen.getByPlaceholderText('pilotByokPlaceholder'), {
      target: { value: 'sk-or-v1-live-customer-pilot-key-00001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'pilotByokSaveBtn' }));
    await waitFor(() => expect(screen.getAllByText('pilotByokReadyBadge').length).toBeGreaterThan(0));

    // 2. Accept pilot terms
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'pilotConsentBtn' }));
    await waitFor(() => expect(screen.getByText('pilotConsentAccepted')).toBeTruthy());

    // 3. Add SaaS Affiliate Offer
    fireEvent.change(screen.getByPlaceholderText('affProductNamePlaceholder'), {
      target: { value: 'SEMrush SEO Toolkit' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://example.com'), {
      target: { value: 'https://www.semrush.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('https://example.com/?via=your-partner-code'), {
      target: { value: 'https://www.semrush.com/?ref=ceo-partner-99' },
    });
    fireEvent.change(screen.getByPlaceholderText('affCommissionTermsPlaceholder'), {
      target: { value: '30% recurring monthly commission' },
    });
    fireEvent.change(screen.getByPlaceholderText('affTargetAudiencePlaceholder'), {
      target: { value: 'SEO agency founders' },
    });
    fireEvent.change(screen.getByPlaceholderText('affInfoSourcePlaceholder'), {
      target: { value: 'Official SEMrush partner terms' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'affSaveOfferBtn' }));
    await waitFor(() => expect(screen.getAllByText('SEMrush SEO Toolkit').length).toBeGreaterThan(0));

    // 4. Generate Affiliate Campaign
    fireEvent.click(screen.getByRole('button', { name: 'affGenerateCampaignBtn' }));
    await waitFor(() =>
      expect(screen.getAllByText('SEMrush SEO Agency Growth Campaign').length).toBeGreaterThan(0),
    );

    // 5. Edit -> Save -> Approve -> Export with preserved referral URL
    fireEvent.click(screen.getByRole('button', { name: 'editScriptBtn' }));
    fireEvent.change(screen.getByLabelText('affCampaignTitleLabel'), {
      target: { value: 'SEMrush Q4 Agency Campaign' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'saveEditsBtn' }));
    await waitFor(() => expect(screen.getByText('draftSavedNotice')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'affApproveCampaignBtn' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'exportMarkdownBtn' })).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'exportMarkdownBtn' }));
    await waitFor(() =>
      expect(screen.getByText(/Verified Referral Link: https:\/\/www\.semrush\.com\/\?ref=ceo-partner-99/)).toBeTruthy(),
    );

    // 6. Record Partner Performance
    fireEvent.change(screen.getByPlaceholderText('affPerfSourcePlaceholder'), {
      target: { value: 'Impact Official Partner CSV' },
    });
    fireEvent.change(screen.getByPlaceholderText('2026-11-W4'), {
      target: { value: '2026-11' },
    });
    fireEvent.change(screen.getByPlaceholderText('stmt-2026-11-01'), {
      target: { value: 'imp-stmt-001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'affRecordPerfBtn' }));
    await waitFor(() => expect(screen.getByText('imp-stmt-001')).toBeTruthy());

    // 7. Submit support request & clear BYOK key
    fireEvent.change(screen.getByPlaceholderText('supportSubjectPlaceholder'), {
      target: { value: 'Question about scenes' },
    });
    fireEvent.change(screen.getByPlaceholderText('supportDetailsPlaceholder'), {
      target: { value: 'Can I export both JSON and Markdown?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'supportSubmitBtn' }));
    await waitFor(() => expect(screen.getByText('psr_live-0001')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'pilotByokClearBtn' }));
    await waitFor(() => expect(screen.getAllByText('pilotByokMissingBadge').length).toBeGreaterThan(0));
  });

  it('suppresses simulated 0-MCU banner on first paint when initialPilotMode=true', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
    render(<FirstValueJourneyClient orgId="org_pilot_1" initialPilotMode />);
    expect(screen.queryByText('simulatedBadge')).toBeNull();
    expect(screen.getByText('pilotByokTitle')).toBeTruthy();
    expect(screen.getByText('openai/gpt-4o-mini')).toBeTruthy();
  });
});
