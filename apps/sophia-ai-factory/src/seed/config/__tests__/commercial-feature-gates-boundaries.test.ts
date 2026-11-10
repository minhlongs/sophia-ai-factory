/**
 * Boundary tests for agency portal actions, handover action variants,
 * client review helpers/routes, and settings namespace gates.
 *
 * @module seed/config/__tests__/commercial-feature-gates-boundaries
 */

import type { D1Database } from '@cloudflare/workers-types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetCurrentUser = vi.fn();
const mockGetCurrentUserFromHeaders = vi.fn();
const mockIsUserAdminWithRole = vi.fn();
const mockIsUserAdmin = vi.fn().mockResolvedValue(true);

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
  getCurrentUserFromHeaders: (...args: unknown[]) => mockGetCurrentUserFromHeaders(...args),
}));
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: (...args: unknown[]) => mockIsUserAdminWithRole(...args),
  isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args),
}));
vi.mock('@/forest/middleware/rate-limit-wrapper', () => ({
  withRateLimit: (fn: (req: NextRequest) => Promise<Response>) => (req: NextRequest) => fn(req),
}));

import { NextRequest } from 'next/server';
import { issueRaasLicenseToken } from '@/seed/security/raas-license-verifier';
import { SettingsValidationError } from '@/seed/tenant-settings/types';
import { triggerHandoverVerificationAction, exportSanitizedEnvAction, getHandoverDetailsAction } from '@/land/actions/handover/handover-actions';
import { authenticateAgencyPortalUser, verifyAgencyOrgMembership, authorizeAgencyOrgAction, getAgencyAdminOverviewAction, submitAgencyOnboardingAction, updateClientSubaccountStatusAction, reallocateClientMcuQuotaAction } from '@/land/agency/portal-actions';
import { guardAgencyReviewPortal, mapGetReviewError, mapPostReviewError } from '@/app/api/client-review/[token]/client-review-helpers';
import { GET as getClientReview, POST as postClientReview } from '@/app/api/client-review/[token]/route';
import { enforceNamespaceGate, handleSettingsError } from '@/app/api/v1/settings/[namespace]/namespace-route-helpers';
import { PUT as putSetting, PATCH as patchSetting } from '@/app/api/v1/settings/[namespace]/route';
import { POST as importSettingsPost } from '@/app/api/v1/settings/import/route';

const LICENSE_SECRET = 'sophia-commercial-gates-test-secret-2026';

describe('Commercial Feature Boundary Guards — Agency, Handover, Review & Settings', () => {
  const origEnv = { ...process.env };
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAAS_LICENSE_SECRET = LICENSE_SECRET;
    delete process.env.RAAS_LICENSE_KEY;
    delete process.env.SOPHIA_EDITION;
  });
  afterEach(() => {
    process.env = { ...origEnv };
  });

  it('covers agency portal, handover variants, client review helpers, and settings gates', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    expect((await triggerHandoverVerificationAction('ho_1')).ok).toBe(false);
    expect((await exportSanitizedEnvAction()).ok).toBe(false);
    expect((await getHandoverDetailsAction('ho_1')).ok).toBe(false);
    expect((await authenticateAgencyPortalUser()).authorized).toBe(false);
    expect((await authorizeAgencyOrgAction('org_1')).ok).toBe(false);

    mockGetCurrentUser.mockResolvedValue({ id: 'usr_nonadmin', email: 'u@agency.vn', role: 'user' });
    mockIsUserAdmin.mockResolvedValueOnce(false);
    expect((await triggerHandoverVerificationAction('ho_1')).ok).toBe(false);
    mockIsUserAdmin.mockResolvedValueOnce(false);
    expect((await exportSanitizedEnvAction()).ok).toBe(false);
    mockIsUserAdmin.mockResolvedValue(true);

    mockGetCurrentUser.mockResolvedValue({ id: 'usr_admin', email: 'cfo@agency.vn', role: 'admin' });
    mockGetCurrentUserFromHeaders.mockResolvedValue({ id: 'usr_admin' });
    mockIsUserAdminWithRole.mockResolvedValue({ isAdmin: true, role: 'admin' });

    process.env.SOPHIA_EDITION = 'community';
    mockIsUserAdmin.mockResolvedValueOnce(false);
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'usr_nonadmin', email: 'u@agency.vn', role: 'user' });
    expect((await authenticateAgencyPortalUser()).authorized).toBe(false);
    const fakeDb = {
      prepare: () => ({ bind: () => ({ first: async () => ({ ownerUserId: 'usr_admin', role: 'member' }), all: async () => ({ results: [{ id: 'p1', amount: 50 }] }) }) }),
    } as unknown as D1Database;

    expect((await triggerHandoverVerificationAction('ho_1')).ok).toBe(false);
    expect((await exportSanitizedEnvAction()).ok).toBe(false);
    expect((await getHandoverDetailsAction('ho_1')).ok).toBe(false);
    expect((await authenticateAgencyPortalUser()).authorized).toBe(false);
    expect(await verifyAgencyOrgMembership(fakeDb, 'org_1', 'usr_admin', false)).toBe(false);
    expect(await verifyAgencyOrgMembership(fakeDb, 'org_1', 'usr_admin', false, true)).toBe(true);
    expect(await verifyAgencyOrgMembership(fakeDb, 'org_1', 'usr_admin', true)).toBe(true);
    expect((await authorizeAgencyOrgAction('org_1', fakeDb)).ok).toBe(false);
    expect((await getAgencyAdminOverviewAction('org_1', undefined, fakeDb)).clients).toEqual([]);
    expect((await submitAgencyOnboardingAction({ agencyOrgId: 'org_1', domain: { customDomain: 'agency.vn' } } as never, fakeDb)).success).toBe(false);
    expect((await updateClientSubaccountStatusAction('sub_1', 'org_1', 'active', fakeDb)).success).toBe(false);
    expect((await reallocateClientMcuQuotaAction('sub_1', 'org_1', 100, fakeDb)).success).toBe(false);

    expect((await guardAgencyReviewPortal(fakeDb, 'tok_raw_123'))?.status).toBe(403);
    expect((await enforceNamespaceGate('usr_admin', 'branding'))?.status).toBe(403);
    expect(await enforceNamespaceGate('usr_admin', 'geo')).toBeNull();
    expect(handleSettingsError('geo', 'PUT', new SettingsValidationError('geo', 'bad')).status).toBe(422);
    expect(handleSettingsError('geo', 'PUT', new Error('boom')).status).toBe(500);
    expect(handleSettingsError('geo', 'PUT', 'raw').status).toBe(500);
    (globalThis as unknown as Record<string, unknown>).__env = { DB: fakeDb };
    expect((await putSetting(new NextRequest('http://localhost/api/v1/settings/branding', { method: 'PUT', body: '{}' }), { params: Promise.resolve({ namespace: 'branding' }) })).status).toBe(403);
    expect((await patchSetting(new NextRequest('http://localhost/api/v1/settings/branding', { method: 'PATCH', body: '{}' }), { params: Promise.resolve({ namespace: 'branding' }) })).status).toBe(403);
    expect((await importSettingsPost(new NextRequest('http://localhost/api/v1/settings/import', { method: 'POST', body: JSON.stringify({ branding: { brandName: 'X' } }) }))).status).toBe(200);
    delete (globalThis as unknown as Record<string, unknown>).__env;

    expect([mapGetReviewError(new Error('REVIEW_NOT_FOUND')).status, mapGetReviewError(new Error('VALIDATION_ERROR: bad')).status, mapGetReviewError('other').status]).toEqual([404, 400, 500]);
    expect([mapPostReviewError(new Error('REVIEW_NOT_FOUND')).status, mapPostReviewError(new Error('REVIEW_EXPIRED')).status, mapPostReviewError(new Error('ALREADY_APPROVED')).status, mapPostReviewError(new Error('INVALID_TOKEN: bad')).status, mapPostReviewError('other').status]).toEqual([404, 410, 409, 400, 500]);

    const masterToken = await issueRaasLicenseToken({ licenseId: 'lic_mst_2', orgId: 'org_1', edition: 'enterprise', tier: 'MASTER', issuedAt: 1700000000, expiresAt: 2000000000 }, LICENSE_SECRET);
    process.env.SOPHIA_EDITION = 'enterprise';
    process.env.RAAS_LICENSE_KEY = masterToken;
    expect((await exportSanitizedEnvAction()).ok).toBe(true);
    expect(await guardAgencyReviewPortal(fakeDb, 'tok_raw_123')).toBeNull();
    expect(await enforceNamespaceGate('usr_admin', 'branding')).toBeNull();
    expect((await authenticateAgencyPortalUser({ requireCustomDomain: true })).authorized).toBe(true);
    expect((await authorizeAgencyOrgAction('org_1', fakeDb, { requireCustomDomain: true })).ok).toBe(true);
    mockIsUserAdmin.mockResolvedValueOnce(false);
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'usr_nonadmin', email: 'u@agency.vn', role: 'user' });
    expect((await authorizeAgencyOrgAction('org_1', fakeDb)).ok).toBe(false);
    expect((await getClientReview(new NextRequest('http://localhost/api/client-review/ '), { params: Promise.resolve({ token: ' ' }) })).status).toBe(400);
    expect((await postClientReview(new NextRequest('http://localhost/api/client-review/ ', { method: 'POST' }), { params: Promise.resolve({ token: ' ' }) })).status).toBe(400);
  });
});
