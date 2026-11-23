import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ScriptOutput } from '@/seed/ai/script-generator';
import type { PilotStatusSnapshot } from '@/seed/pilot/pilot-access-policy';
import type { DurableFirstValueReview } from '@/tree/first-value/first-value-review-repo';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { FirstValuePilotBanner } from '../first-value-pilot-banner';
import { FirstValueFeedbackCard } from '../first-value-feedback-card';
import { FirstValueReviewPanel } from '../first-value-review-panel';

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
    expect(savedArg?.scenes[0]?.narration).toBe('Updated Scene 1 narration');
    expect(savedArg?.scenes[0]?.visual_description).toBe('Updated Scene 1 visual');

    rerender(
      <FirstValueReviewPanel
        review={makeReview('accepted')}
        busy={false}
        onAccept={vi.fn(async () => {})}
        onReject={vi.fn(async () => {})}
        onExport={vi.fn(async () => {})}
        onEdit={onEdit}
        exportPayload="# Updated Pilot Title"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'copyExportBtn' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('# Updated Pilot Title');
      expect(screen.getByRole('button', { name: 'copiedBtn' })).toBeTruthy();
    });
  });
});
