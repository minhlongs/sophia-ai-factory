// @vitest-environment jsdom
/**
 * UI & Page tests for Compliance Publish Gate (MOCK_ONLY).
 * Covers ComplianceControls, PublishGateClient, and PublishGateDashboardPage.
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PublishGateCompliance, PublishGateRecord } from '@/tree/publish-gate/types';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}));

vi.mock('@/navigation', () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) =>
    React.createElement('a', { href, ...props }, children),
}));

const mockGetCurrentUser = vi.fn();
const mockResolveOrgId = vi.fn();
const mockIsEnabled = vi.fn();
const mockGetD1 = vi.fn();
const mockEnsureCustomerOrg = vi.fn();

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock('@/seed/auth/workspace-access', () => ({
  resolveOrgId: (...args: unknown[]) => mockResolveOrgId(...args),
}));

vi.mock('@/seed/config/flags', () => ({
  isB2CompliancePublishGateEnabled: () => mockIsEnabled(),
}));

vi.mock('@/seed/db/client', () => ({
  getD1: () => mockGetD1(),
}));

vi.mock('@/tree/handover/handover-account-setup', () => ({
  ensureCustomerOrg: (...args: unknown[]) => mockEnsureCustomerOrg(...args),
}));

import { ComplianceControls } from '../compliance-controls';
import { PublishGateClient } from '../publish-gate-client';
import PublishGateDashboardPage, {
  generateMetadata,
} from '@/app/[locale]/dashboard/publish-gate/page';

function makeRecord(overrides: Partial<PublishGateRecord> = {}): PublishGateRecord {
  return {
    requestId: 'pg_req_1',
    orgId: 'org_1',
    userId: 'user_1',
    campaignId: 'camp_org_1',
    mediaArtifactId: 'artifact_b2_demo_v1',
    mediaContentDigest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    platform: 'tiktok',
    destinationAccountId: 'tt_unaudited_demo_01',
    publicationMode: 'MOCK_ONLY',
    state: 'PREFLIGHT_REQUIRED',
    idempotencyKey: 'v1:idem',
    payloadDigestSha256: 'v1:sha256:abc',
    payload: {
      campaignId: 'camp_org_1',
      mediaArtifactId: 'artifact_b2_demo_v1',
      mediaContentDigest: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      mediaDurationSec: 30,
      platform: 'tiktok',
      destinationAccountId: 'tt_unaudited_demo_01',
      destinationAccountHandle: '@tt_unaudited_demo_01',
      caption: 'Hello',
      payloadVersion: 1,
      publicationMode: 'MOCK_ONLY',
      compliance: { aiSyntheticDisclosure: true, commercialDisclosure: false },
    },
    capabilitySnapshot: null,
    compliance: { aiSyntheticDisclosure: true, commercialDisclosure: false },
    approvalNonce: null,
    approvalNonceUsedAtIso: null,
    approvalVersion: 1,
    approvalExpiresAtIso: null,
    approvedByUserId: null,
    approvedAtIso: null,
    rejectionReason: null,
    executionClaimId: null,
    mockReceipt: null,
    version: 1,
    createdAtIso: '2026-11-22T00:00:00.000Z',
    updatedAtIso: '2026-11-22T00:00:00.000Z',
    ...overrides,
  };
}

describe('ComplianceControls', () => {
  afterEach(() => {
    cleanup();
  });

  it('handles TikTok privacy, music attestation, AIGC, and nested commercial disclosures', () => {
    const onChange = vi.fn();
    const initial: PublishGateCompliance = {
      aiSyntheticDisclosure: true,
      commercialDisclosure: true,
      tiktok: {
        privacyLevel: null,
        commercialContentToggle: true,
        brandOrganicToggle: false,
        brandContentToggle: true,
        isAigc: true,
        musicUsageConfirmed: false,
        brandedContentPolicyConfirmed: false,
        allowComment: true,
        allowDuet: false,
        allowStitch: false,
        useDraftInboxFallback: false,
      },
    };
    render(
      React.createElement(ComplianceControls, {
        platform: 'tiktok',
        compliance: initial,
        allowedPrivacyOptions: ['SELF_ONLY'],
        onChange,
      }),
    );

    fireEvent.change(screen.getByLabelText('privacyLabel'), { target: { value: 'SELF_ONLY' } });
    fireEvent.click(screen.getByText('tiktokMusicAttestation'));
    fireEvent.click(screen.getByText('aiSyntheticLabel'));
    fireEvent.click(screen.getByText('commercialDisclosureLabel'));
    fireEvent.click(screen.getByText('tiktokBrandOrganic'));
    fireEvent.click(screen.getByText('tiktokBrandContent'));
    fireEvent.click(screen.getByText('tiktokBrandedPolicyConfirm'));
    expect(onChange).toHaveBeenCalledTimes(7);
  });

  it('handles YouTube and Instagram controls including fallback defaults', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      React.createElement(ComplianceControls, {
        platform: 'youtube',
        compliance: { aiSyntheticDisclosure: false, commercialDisclosure: false },
        allowedPrivacyOptions: ['private', 'unlisted', 'public'],
        onChange,
      }),
    );

    fireEvent.change(screen.getByLabelText('privacyLabel'), { target: { value: 'private' } });
    fireEvent.change(screen.getByLabelText('youtubeMadeForKidsLabel'), { target: { value: 'false' } });
    fireEvent.change(screen.getByLabelText('youtubeSyntheticLabel'), { target: { value: 'true' } });
    expect(onChange).toHaveBeenCalledTimes(3);

    rerender(
      React.createElement(ComplianceControls, {
        platform: 'instagram',
        compliance: { aiSyntheticDisclosure: false, commercialDisclosure: false },
        allowedPrivacyOptions: ['PROFESSIONAL_FEED_OR_REEL'],
        onChange,
      }),
    );

    fireEvent.change(screen.getByLabelText('instagramAccountTypeLabel'), {
      target: { value: 'CREATOR' },
    });
    fireEvent.click(screen.getByText('instagramContainerReadyLabel'));
    fireEvent.click(screen.getByText('instagramPaidPartnershipLabel'));
    expect(onChange).toHaveBeenCalledTimes(6);
  });
});

describe('PublishGateClient', () => {
  const fetchSpy = vi.fn();

  beforeEach(() => {
    fetchSpy.mockReset();
    vi.stubGlobal('fetch', fetchSpy);
    document.cookie = 'csrf-token=test_csrf_123';
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('drives create -> mutate -> preflight -> submit -> approve -> execute_mock and renders receipt', async () => {
    const created = makeRecord({ state: 'PREFLIGHT_REQUIRED' });
    const blocked = makeRecord({
      state: 'PREFLIGHT_BLOCKED',
      capabilitySnapshot: {
        platform: 'tiktok',
        capabilityStatus: 'RESTRICTED',
        verifiedDate: '2026-11-22',
        isAuditedApp: false,
        allowedPrivacyOptions: ['SELF_ONLY'],
        maxVideoDurationSec: 600,
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        dailyPublishLimit: 5,
        dailyPublishUsed: 0,
        requiredScopes: ['video.publish'],
        warnings: [],
        blockReasons: ['TIKTOK_PRIVACY_EXPLICIT_SELECTION_REQUIRED'],
      },
    });
    const ready = makeRecord({ state: 'READY_FOR_REVIEW' });
    const awaiting = makeRecord({
      state: 'AWAITING_HUMAN_APPROVAL',
      approvalNonce: 'nonce_abc',
      capabilitySnapshot: { ...blocked.capabilitySnapshot!, blockReasons: [] },
    });
    const approved = makeRecord({ state: 'APPROVED' });
    const published = makeRecord({
      state: 'SIMULATED_PUBLISHED',
      mockReceipt: {
        publicationMode: 'MOCK_ONLY',
        simulated: true,
        simulatedStatus: 'SIMULATED_PUBLISHED',
        platform: 'tiktok',
        mockReceiptId: 'mock_tiktok_1',
        publicUrl: null,
        draftInboxRouted: false,
        retriable: false,
        errorCode: null,
        message: 'Simulated OK',
        executedAtIso: '2026-11-22T00:05:00.000Z',
        payloadDigestSha256: 'v1:sha256:abc',
        executionClaimId: 'claim_1',
      },
    });

    const responses = [created, blocked, created, ready, awaiting, approved, published];
    fetchSpy.mockImplementation(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ record: responses.shift() }),
    }));

    render(React.createElement(PublishGateClient, { orgId: 'org_1' }));
    expect(screen.getByText('mockBannerTitle')).toBeTruthy();

    // Switch platform to youtube, instagram, and back to tiktok to exercise platform reset
    fireEvent.change(screen.getByLabelText('platformLabel'), { target: { value: 'youtube' } });
    fireEvent.change(screen.getByLabelText('videoTitleLabel'), { target: { value: 'New Title' } });
    fireEvent.change(screen.getByLabelText('platformLabel'), { target: { value: 'instagram' } });
    fireEvent.change(screen.getByLabelText('platformLabel'), { target: { value: 'tiktok' } });
    fireEvent.change(screen.getByLabelText('destinationAccountLabel'), {
      target: { value: 'tt_demo_2' },
    });
    fireEvent.change(screen.getByLabelText('captionLabel'), { target: { value: 'Updated caption' } });

    fireEvent.click(screen.getByText('createRequestButton'));
    await waitFor(() => expect(screen.getByText('PREFLIGHT_REQUIRED')).toBeTruthy());

    fireEvent.click(screen.getByText('runPreflightButton'));
    await waitFor(() =>
      expect(screen.getByText('TIKTOK_PRIVACY_EXPLICIT_SELECTION_REQUIRED')).toBeTruthy(),
    );

    fireEvent.click(screen.getByText('updatePayloadButton'));
    await waitFor(() => expect(screen.getByText('PREFLIGHT_REQUIRED')).toBeTruthy());

    fireEvent.click(screen.getByText('runPreflightButton'));
    await waitFor(() => expect(screen.getByText('submitForApprovalButton')).toBeTruthy());

    fireEvent.click(screen.getByText('submitForApprovalButton'));
    await waitFor(() => expect(screen.getByText('approveButton')).toBeTruthy());

    fireEvent.click(screen.getByText('approveButton'));
    await waitFor(() => expect(screen.getByText('executeMockButton')).toBeTruthy());

    fireEvent.click(screen.getByText('executeMockButton'));
    await waitFor(() => expect(screen.getByText('mock_tiktok_1')).toBeTruthy());
  });

  it('displays server error responses and network failures cleanly', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ error: 'ADMIN_ROLE_REQUIRED', record: makeRecord() }),
    });

    render(React.createElement(PublishGateClient, { orgId: 'org_1' }));
    fireEvent.click(screen.getByText('createRequestButton'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('ADMIN_ROLE_REQUIRED'));

    fetchSpy.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByText('createRequestButton'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('NETWORK_ERROR'));
  });
});

describe('PublishGateDashboardPage (RSC)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('returns translated metadata', async () => {
    const meta = await generateMetadata();
    expect(meta.title).toBe('metaTitle');
    expect(meta.description).toBe('metaDescription');
  });

  it('redirects unauthenticated users to locale login', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    await expect(
      PublishGateDashboardPage({ params: Promise.resolve({ locale: 'vi' }) }),
    ).rejects.toThrow('REDIRECT:/vi/login');
  });

  it('renders fail-closed disabled notice when feature flag is off', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user_1', email: 'u@example.com' });
    mockIsEnabled.mockReturnValueOnce(false);
    const el = await PublishGateDashboardPage({ params: Promise.resolve({ locale: 'en' }) });
    render(el);
    expect(screen.getByText('disabledTitle')).toBeTruthy();
  });

  it('renders PublishGateClient when enabled and provisions org fallback when needed', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user_1', email: 'u@example.com' });
    mockIsEnabled.mockReturnValueOnce(true);
    mockGetD1.mockResolvedValueOnce({});
    mockResolveOrgId.mockResolvedValueOnce(null);
    mockEnsureCustomerOrg.mockResolvedValueOnce('org_created_1');

    const el = await PublishGateDashboardPage({ params: Promise.resolve({ locale: 'en' }) });
    render(el);
    expect(screen.getByText('title')).toBeTruthy();
    expect(screen.getByText('mockBannerTitle')).toBeTruthy();
    expect(mockEnsureCustomerOrg).toHaveBeenCalledTimes(1);
  });
});
