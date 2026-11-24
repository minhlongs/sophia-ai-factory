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
      });
      expect(screen.getByText('feedbackSubmittedSuccess')).toBeTruthy();
    });

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
    expect(screen.getByText('Hỗ trợ & Xóa dữ liệu')).toBeTruthy();
    expect(screen.getByText('customer@example.test')).toBeTruthy();
    expect(screen.getByText('Pilot Child Content')).toBeTruthy();

    rerender(
      <PilotWorkspaceShell email="" isVi={false}>
        <div>Pilot EN Content</div>
      </PilotWorkspaceShell>,
    );
    expect(screen.getByText('Support & Deletion')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });
});

describe('FirstValueJourneyClient Customer BYOK live pilot flow', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('drives BYOK save -> consent -> live generate -> support request -> BYOK clear over /api/first-value', async () => {
    let byokSaved = false;
    let consented = false;
    const review = makeReview('pending_review');

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
      if (body.action === 'create_review') {
        return new Response(JSON.stringify({ review }), { status: 201 });
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

    render(<FirstValueJourneyClient orgId="org_pilot_1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('openai/gpt-4o-mini')).toBeTruthy();
    });

    // Save BYOK key
    fireEvent.change(screen.getByPlaceholderText('pilotByokPlaceholder'), {
      target: { value: 'sk-or-v1-live-customer-pilot-key-00001' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'pilotByokSaveBtn' }));
    await waitFor(() => expect(screen.getByText('pilotByokReadyBadge')).toBeTruthy());

    // Accept pilot terms
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'pilotConsentBtn' }));
    await waitFor(() => expect(screen.getByText('pilotConsentAccepted')).toBeTruthy());

    // Generate live AI script
    fireEvent.click(screen.getByRole('button', { name: 'pilotGenerateBtn' }));
    await waitFor(() => expect(screen.getByText('Initial Script Title')).toBeTruthy());

    // Submit support request
    fireEvent.change(screen.getByPlaceholderText('supportSubjectPlaceholder'), {
      target: { value: 'Question about scenes' },
    });
    fireEvent.change(screen.getByPlaceholderText('supportDetailsPlaceholder'), {
      target: { value: 'Can I export both JSON and Markdown?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'supportSubmitBtn' }));
    await waitFor(() => expect(screen.getByText('psr_live-0001')).toBeTruthy());

    // Clear BYOK key
    fireEvent.click(screen.getByRole('button', { name: 'pilotByokClearBtn' }));
    await waitFor(() => expect(screen.getByText('pilotByokMissingBadge')).toBeTruthy());
  });
});
