import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import React from 'react';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getD1: vi.fn(),
  listPublishedListings: vi.fn().mockResolvedValue([]),
  fetchAuthorBrandings: vi.fn().mockResolvedValue(new Map()),
  listCreatorTemplates: vi.fn(),
  createCreatorTemplate: vi.fn(),
  listCreatorWithdrawals: vi.fn(),
  createCreatorWithdrawalRequest: vi.fn(),
  getCreatorUnencumberedBalance: vi.fn(),
  getVietQrPaymentInfo: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/seed/db/client', () => ({
  getD1: mocks.getD1,
}));

vi.mock('@/seed/db/marketplace-ops', () => ({
  createCreatorProfile: vi.fn(),
  getCreatorProfile: vi.fn(),
  updateCreatorProfile: vi.fn(),
  createSopListing: vi.fn(),
  getSopListing: vi.fn(),
  updateSopListing: vi.fn(),
  getSopInstall: vi.fn(),
  createSopInstall: vi.fn(),
  createSopReview: vi.fn(),
}));

vi.mock('@/seed/db/org-membership', () => ({
  requireOrgMembership: vi.fn(),
}));

vi.mock('@/seed/sop/sop-repo-marketplace', () => ({
  listPublishedListings: mocks.listPublishedListings,
}));

vi.mock('@/tree/branding/org-branding-repo', () => ({
  fetchAuthorBrandings: mocks.fetchAuthorBrandings,
}));

vi.mock('@/land/creator/creator-studio-service', () => ({
  listCreatorTemplates: mocks.listCreatorTemplates,
  createCreatorTemplate: mocks.createCreatorTemplate,
}));

vi.mock('@/land/creator/creator-withdrawal-service', () => ({
  listCreatorWithdrawals: mocks.listCreatorWithdrawals,
  createCreatorWithdrawalRequest: mocks.createCreatorWithdrawalRequest,
  getCreatorUnencumberedBalance: mocks.getCreatorUnencumberedBalance,
  getVietQrPaymentInfo: mocks.getVietQrPaymentInfo,
}));

import { registerCreator, getCreatorProfile, updateCreatorProfile } from '../creator-onboarding';
import { createSopListing, updateSopListing, listMyListings } from '../listing-manager';
import {
  submitForReview,
  publishListing,
  archiveListing,
  approveListingAdmin,
  rejectListingAdmin,
} from '../listing-manager';
import { installSop, uninstallSop } from '../install-handler';
import { createNewListing } from '@/app/(app)/dashboard/sop-creator/new/actions';
import { submitCreatorApplication } from '@/app/(app)/dashboard/sop-creator/apply/actions';
import {
  approveSopListing,
  POST as approveSopReviewRoute,
} from '@/app/(app)/dashboard/admin/sop-reviews/[id]/approve/route';
import {
  rejectSopListing,
  POST as rejectSopReviewRoute,
} from '@/app/(app)/dashboard/admin/sop-reviews/[id]/reject/route';
import { POST as submitReview } from '@/app/api/sop-marketplace/review/route';
import { GET as getV1MarketplaceCatalog } from '@/app/api/sop-marketplace/route';
import {
  GET as getCreatorTemplates,
  POST as postCreatorTemplate,
} from '@/app/api/creator/templates/route';
import {
  GET as getCreatorWithdrawals,
  POST as postCreatorWithdrawal,
} from '@/app/api/creator/withdrawals/route';
import { checkCreatorAccess } from '@/app/(app)/dashboard/sop-creator/ServerGate';
import { AdminSOPReviewsContent } from '@/app/(app)/dashboard/admin/sop-reviews/modules/admin-sop-reviews-content';
import { ListingDetail } from '@/app/(app)/dashboard/sop-creator/[id]/modules/listing-detail';
import { MarketplaceUnavailableNotice } from '@/components/sop-marketplace/marketplace-unavailable-notice';
import { useCreatorStudioData } from '@/app/[locale]/(app)/creator/studio/components/use-creator-studio-data';

const authenticatedUser = { id: 'user-creator', email: 'creator@example.com', role: 'user' };

const unavailableActions: Array<[string, () => Promise<unknown>]> = [
  ['creator registration', () => registerCreator({
    displayName: 'Creator',
    payoutMethod: 'nowpayments',
    payoutAddress: 'TRC20-address',
  })],
  ['creator profile read', () => getCreatorProfile()],
  ['creator profile update', () => updateCreatorProfile({ bio: 'Updated bio' })],
  ['listing creation', () => createSopListing({ title: 'SOP', priceCents: 0, sopTemplateId: 'template-1' })],
  ['listing update', () => updateSopListing('listing-1', { title: 'Updated' })],
  ['creator listing query', () => listMyListings()],
  ['listing review submission', () => submitForReview('listing-1')],
  ['listing publish', () => publishListing('listing-1')],
  ['listing archive', () => archiveListing('listing-1')],
  ['admin listing approval', () => approveListingAdmin('listing-1')],
  ['admin listing rejection', () => rejectListingAdmin('listing-1', 'reason')],
  ['free listing install', () => installSop('listing-free-1')],
  ['paid listing install', () => installSop('listing-paid-1')],
  ['listing uninstall', () => uninstallSop('license-1')],
  ['dashboard listing creation action', () => createNewListing({
    title: 'SOP', priceCents: 0, sopTemplateId: 'template-1',
  })],
  ['creator application action', () => submitCreatorApplication({
    website: 'https://example.com', niche: 'education', subscribers: '1k-10k',
    monthlyViews: '10k-50k', experience: 'Experience', whyJoin: 'Reason',
  })],
  ['admin approve route action', () => approveSopListing('listing-1')],
  ['admin reject route action', () => rejectSopListing('listing-1', 'reason')],
];

function errorCode(result: unknown): string | undefined {
  const value = result as { code?: string; error?: { code?: string } };
  return value.code ?? value.error?.code;
}

describe('Creator Marketplace V2 containment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue(authenticatedUser);
    mocks.getD1.mockResolvedValue({});
    mocks.listPublishedListings.mockResolvedValue([]);
    mocks.fetchAuthorBrandings.mockResolvedValue(new Map());
  });

  it.each(unavailableActions)('%s returns unavailable before opening D1', async (_name, action) => {
    const result = await action();

    expect(errorCode(result)).toBe('MARKETPLACE_TEMPORARILY_UNAVAILABLE');
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('keeps unauthenticated responses ahead of the maintenance code', async () => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);

    const result = await getCreatorProfile();

    expect(errorCode(result)).toBe('NOT_AUTHENTICATED');
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('returns HTTP 503 and the stable code for Marketplace review submissions', async () => {
    const request = new Request('https://example.test/api/sop-marketplace/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ installId: 'install-1', listingId: 'listing-1', rating: 5 }),
    });

    const response = await submitReview(request as never);
    const body = (await response.json()) as { code?: string; error?: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe('MARKETPLACE_TEMPORARILY_UNAVAILABLE');
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it.each([
    ['approve', approveSopReviewRoute],
    ['reject', rejectSopReviewRoute],
  ])('returns HTTP 503 and the stable code for admin %s routes', async (_name, route) => {
    const response = await route(
      new Request('https://example.test/admin/sop-reviews/listing-1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'not ready' }),
      }),
      { params: Promise.resolve({ id: 'listing-1' }) },
    );
    const body = (await response.json()) as { code?: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe('MARKETPLACE_TEMPORARILY_UNAVAILABLE');
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('keeps the authenticated creator gate unavailable before D1 access', async () => {
    const access = await checkCreatorAccess();

    expect(access).toEqual({
      hasAccess: false,
      userId: authenticatedUser.id,
      tier: null,
      marketplaceAvailable: false,
    });
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('does not query V2 tables from admin or listing detail page content', async () => {
    await AdminSOPReviewsContent({ locale: 'vi', userId: 'admin-1' });
    await ListingDetail({ locale: 'vi', listingId: 'listing-1', userId: authenticatedUser.id });

    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('keeps the legacy V1 public catalog route available', async () => {
    const response = await getV1MarketplaceCatalog(
      new Request('https://example.test/api/sop-marketplace') as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.listPublishedListings).toHaveBeenCalledOnce();
    expect(mocks.getD1).toHaveBeenCalledOnce();
  });

  it.each([
    ['GET /api/creator/templates', () => getCreatorTemplates(new Request('https://example.test/api/creator/templates') as never)],
    ['POST /api/creator/templates', () => postCreatorTemplate(new Request('https://example.test/api/creator/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Template' }),
    }) as never)],
    ['GET /api/creator/withdrawals', () => getCreatorWithdrawals(new Request('https://example.test/api/creator/withdrawals') as never)],
    ['POST /api/creator/withdrawals', () => postCreatorWithdrawal(new Request('https://example.test/api/creator/withdrawals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountCents: 2000, rail: 'USDT', destinationAddress: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb' }),
    }) as never)],
  ])('returns HTTP 503 and MARKETPLACE_TEMPORARILY_UNAVAILABLE for %s before D1 access', async (_name, callRoute) => {
    const response = await callRoute();
    const body = (await response.json()) as { code?: string; error?: string };

    expect(response.status).toBe(503);
    expect(body.code).toBe('MARKETPLACE_TEMPORARILY_UNAVAILABLE');
    expect(body.error).toBeTruthy();
    expect(mocks.getD1).not.toHaveBeenCalled();
    expect(mocks.listCreatorTemplates).not.toHaveBeenCalled();
    expect(mocks.createCreatorTemplate).not.toHaveBeenCalled();
    expect(mocks.listCreatorWithdrawals).not.toHaveBeenCalled();
    expect(mocks.createCreatorWithdrawalRequest).not.toHaveBeenCalled();
    expect(mocks.getCreatorUnencumberedBalance).not.toHaveBeenCalled();
  });

  it.each([
    ['GET /api/creator/templates', () => getCreatorTemplates(new Request('https://example.test/api/creator/templates') as never)],
    ['POST /api/creator/templates', () => postCreatorTemplate(new Request('https://example.test/api/creator/templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Template' }),
    }) as never)],
    ['GET /api/creator/withdrawals', () => getCreatorWithdrawals(new Request('https://example.test/api/creator/withdrawals') as never)],
    ['POST /api/creator/withdrawals', () => postCreatorWithdrawal(new Request('https://example.test/api/creator/withdrawals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ amountCents: 2000, rail: 'USDT' }),
    }) as never)],
  ])('returns HTTP 401 UNAUTHORIZED ahead of maintenance code when unauthenticated on %s', async (_name, callRoute) => {
    mocks.getCurrentUser.mockResolvedValueOnce(null);

    const response = await callRoute();
    const body = (await response.json()) as { error?: string; code?: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.code).toBeUndefined();
    expect(mocks.getD1).not.toHaveBeenCalled();
  });

  it('renders bilingual VI/EN maintenance notice and skips Creator Studio API fetches when V2 is disabled', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(React.createElement(MarketplaceUnavailableNotice));
    expect(
      screen.getByText(/Creator Marketplace tạm thời bảo trì \/ temporarily unavailable/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/Chúng tôi đang đối soát tính toàn vẹn dữ liệu/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/We are reconciling database integrity/i),
    ).toBeTruthy();

    const { result } = renderHook(() => useCreatorStudioData(true));
    expect(result.current.loading).toBe(false);

    await result.current.handleCreateTemplate({ preventDefault: vi.fn() } as never);
    await result.current.handleCreateWithdrawal({ preventDefault: vi.fn() } as never);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
