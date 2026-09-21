/**
 * Customer Handover Server Actions Test Suite
 * Tests: signHandoverAcceptanceAction, triggerHandoverVerificationAction, exportSanitizedEnvAction, getHandoverDetailsAction.
 *
 * @vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  signHandoverAcceptanceAction,
  triggerHandoverVerificationAction,
  exportSanitizedEnvAction,
  getHandoverDetailsAction,
} from '@/land/actions/handover-actions';
vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdmin: vi.fn().mockResolvedValue(true),
  isUserAdminWithRole: vi.fn().mockResolvedValue({ isAdmin: true, dbRole: 'admin' }),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { isUserAdmin } from '@/seed/auth/is-user-admin';
import * as authSession from '@/seed/auth/better-auth-session';
import * as dbClient from '@/seed/db/client';
import * as handoverService from '@/tree/handover/customer-handover-service';
import * as day1Engine from '@/tree/handover/day1-verification-engine';
import type { D1Database } from '@/seed/db/client';
import type {
  CustomerHandoverRecord,
  HandoverAcceptanceInput,
  HandoverCertificate,
  VerificationRunReport,
  CheckpointResult,
} from '@/seed/handover/handover-types';

describe('Handover Server Actions (Land Layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser = {
    id: 'usr_admin_123',
    email: 'admin@sophia.agencyos.network',
    name: 'Admin User',
    role: 'admin',
  };

  const mockRecord: CustomerHandoverRecord = {
    id: 'ho_act_001',
    customer_user_id: 'usr_cust_001',
    agency_name: 'Starlight Media',
    agency_type: 'ecom',
    tier: 'PRO',
    starter_sops: null,
    magic_link_token: null,
    magic_link_expires_at: null,
    created_by_admin_id: 'usr_admin_123',
    created_at: 1774000000000,
    welcome_email_sent_at: null,
    customer_first_login_at: null,
    customer_first_sop_install_at: null,
    customer_first_run_at: null,
    status: 'active',
    source: 'manual',
    trigger_payment_id: null,
    tenant_id: 'tenant_starlight',
    signer_name: null,
    signer_email: null,
    signer_role: null,
    certificate_hash: null,
    acceptance_status: 'pending',
    verification_results: null,
    signed_at: null,
    verification_passed_at: null,
    certificate_r2_key: null,
    notes: null,
  };

  const mockCertificate: HandoverCertificate = {
    id: 'cert_act_001',
    handoverId: 'ho_act_001',
    tenantId: 'tenant_starlight',
    customerName: 'Starlight Media',
    customerEmail: 'ceo@starlight.io',
    signerName: 'Laura Craft',
    signerEmail: 'ceo@starlight.io',
    signerRole: 'Chief Executive Officer',
    tier: 'PRO',
    deployedSha: 'a1b2c3d4e5f6',
    certificateSha256: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    verificationResults: null,
    contentMarkdown: '# Certificate',
    metadataJson: null,
    createdAt: 1774000100000,
  };

  describe('signHandoverAcceptanceAction', () => {
    const validSignInput: HandoverAcceptanceInput = {
      handoverId: 'ho_act_001',
      signerName: 'Laura Craft',
      signerEmail: 'ceo@starlight.io',
      signerRole: 'Chief Executive Officer',
      notes: 'Handover complete and accepted.',
    };

    it('returns UNAUTHORIZED failure when user is not authenticated', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(null);

      const res = await signHandoverAcceptanceAction(validSignInput);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
        expect(res.error.message).toContain('Authentication required');
      }
    });

    it('returns INVALID_INPUT failure when mandatory input fields are missing', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);

      const invalidInput = { ...validSignInput, signerName: '' };
      const res = await signHandoverAcceptanceAction(invalidInput);

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_INPUT');
      }
    });

    it('returns DB_UNAVAILABLE failure when D1 binding is null', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue(null);

      const res = await signHandoverAcceptanceAction(validSignInput);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('DB_UNAVAILABLE');
      }
    });

    it('returns NOT_FOUND failure when target handover does not exist', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue(null);

      const res = await signHandoverAcceptanceAction(validSignInput);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns success with certificate and updated record on valid sign-off', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue(mockRecord);

      const mockProbes: CheckpointResult[] = [
        {
          checkpointId: 'edge_responsiveness',
          name: 'Edge',
          nameVi: 'Edge',
          category: 'edge',
          status: 'PASS',
          latencyMs: 10,
          details: 'OK',
        },
      ];
      vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockProbes);

      const updatedRecord = { ...mockRecord, acceptance_status: 'accepted' as const };
      vi.spyOn(handoverService, 'recordHandoverAcceptance').mockResolvedValue({
        certificate: mockCertificate,
        record: updatedRecord,
      });

      const res = await signHandoverAcceptanceAction(validSignInput);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.certificate.id).toBe('cert_act_001');
        expect(res.value.record.acceptance_status).toBe('accepted');
      }
    });

    it('returns ALREADY_ACCEPTED failure when handover is already accepted', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue({
        ...mockRecord,
        acceptance_status: 'accepted',
      });

      const res = await signHandoverAcceptanceAction(validSignInput);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('ALREADY_ACCEPTED');
      }
    });

    it('returns FORBIDDEN failure when user is not tenant owner and not admin', async () => {
      const nonAdminUser = { id: 'usr_stranger', email: 'stranger@other.com', name: 'Stranger', role: 'user' };
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(nonAdminUser as any);
      vi.mocked(isUserAdmin).mockResolvedValueOnce(false);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue(mockRecord);

      const res = await signHandoverAcceptanceAction(validSignInput);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });

    it('returns INVALID_INPUT failure when role is not in allowed whitelist', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);

      const res = await signHandoverAcceptanceAction({
        ...validSignInput,
        signerRole: 'Hacker_Role',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_INPUT');
      }
    });
  });

  describe('triggerHandoverVerificationAction', () => {
    it('returns UNAUTHORIZED failure when unauthenticated', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(null);

      const res = await triggerHandoverVerificationAction('ho_act_001');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('executes probes, computes overall verdict, and persists to D1 if handoverId given', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);

      const mockDb = {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        }),
      } as unknown as D1Database;
      vi.spyOn(dbClient, 'getD1').mockResolvedValue(mockDb);

      const mockProbes: CheckpointResult[] = [
        {
          checkpointId: 'd1_crud_consistency',
          name: 'D1 CRUD',
          nameVi: 'D1',
          category: 'database',
          status: 'PASS',
          latencyMs: 15,
          details: 'OK',
        },
      ];
      vi.spyOn(day1Engine, 'runAllDay1Probes').mockResolvedValue(mockProbes);

      const res = await triggerHandoverVerificationAction('ho_act_001');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.overallVerdict).toBe('PASS');
        expect(res.value.totalChecks).toBe(1);
        expect(res.value.passedCount).toBe(1);
        expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE customer_handovers'));
      }
    });

    it('returns FORBIDDEN failure when caller is not admin', async () => {
      const nonAdminUser = { id: 'usr_cust', email: 'cust@client.com', name: 'Cust', role: 'user' };
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(nonAdminUser as any);
      vi.mocked(isUserAdmin).mockResolvedValueOnce(false);

      const res = await triggerHandoverVerificationAction('ho_act_001');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });
  });

  describe('exportSanitizedEnvAction', () => {
    it('returns UNAUTHORIZED failure when unauthenticated', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(null);

      const res = await exportSanitizedEnvAction();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns FORBIDDEN failure when caller is not admin', async () => {
      const nonAdminUser = { id: 'usr_cust', email: 'cust@client.com', name: 'Cust', role: 'user' };
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(nonAdminUser as any);
      vi.mocked(isUserAdmin).mockResolvedValueOnce(false);

      const res = await exportSanitizedEnvAction();
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('FORBIDDEN');
      }
    });

    it('successfully generates sanitized environment export for authenticated user', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      process.env.BETTER_AUTH_SECRET = 'secret_better_auth_32chars_test';

      const res = await exportSanitizedEnvAction();
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.sanitizedContent).toContain('SOPHIA AI FACTORY — SANITIZED CUSTOMER PRODUCTION ENVIRONMENT EXPORT');
        expect(res.value.sanitizedContent).toContain('BETTER_AUTH_SECRET=[REDACTED_SECRET:len=31]');
        expect(res.value.totalKeys).toBeGreaterThan(10);
      }
    });
  });

  describe('getHandoverDetailsAction', () => {
    it('returns UNAUTHORIZED failure when unauthenticated', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(null);

      const res = await getHandoverDetailsAction('ho_act_001');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('returns NOT_FOUND failure when handover does not exist', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue(null);

      const res = await getHandoverDetailsAction('non_existent_ho');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_FOUND');
      }
    });

    it('returns handover record and associated certificate on success', async () => {
      vi.spyOn(authSession, 'getCurrentUser').mockResolvedValue(mockUser as any);
      vi.spyOn(dbClient, 'getD1').mockResolvedValue({} as D1Database);
      vi.spyOn(handoverService, 'getCustomerHandover').mockResolvedValue(mockRecord);
      vi.spyOn(handoverService, 'getHandoverCertificate').mockResolvedValue(mockCertificate);

      const res = await getHandoverDetailsAction('ho_act_001');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.handover.id).toBe('ho_act_001');
        expect(res.value.certificate?.id).toBe('cert_act_001');
      }
    });
  });
});
