/**
 * Adversarial Forensic Security & Reliability Test Suite
 *
 * Exercises critical security and reliability boundaries identified during forensic audit:
 * 1. Anti-Drop: Dynamic SDK checkout invoice webhook routing (preserves revenue)
 * 2. Mission State Machine: Verifies terminal 'failed' & 'cancelled' transitions
 * 3. Fail-Closed Founder Bootstrap: Unverified founder email rejected
 * 4. Cross-Tenant IDOR: Mission access restricted strictly to workspace owner
 * 5. Diagnostics Redaction: Zero credential leaks in diagnostic exports
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { canTransition } from '@/tree/mission/types';
import { bootstrapFounderIfConfigured } from '@/seed/auth/founder-bootstrap';
import { redactSensitiveData } from '@/tree/diagnostics/safe-bundle-generator';
import { dispatchFinished } from '@/land/billing/nowpayments-ipn-dispatch';
import * as subscriptionHandlers from '@/land/billing/nowpayments-ipn-subscription';
import type { NowPaymentsIpnPayload } from '@/land/billing/nowpayments-ipn-handlers';
import { success } from '@/seed/types/result';

describe('Adversarial Forensic Audit Test Suite', () => {
  describe('1. Billing & Payment Gateway: Dynamic Invoice Anti-Drop Protection', () => {
    it('routes dynamic SDK checkout invoice with valid order_id to subscription handler instead of dropping', async () => {
      const handleFinishedSpy = vi
        .spyOn(subscriptionHandlers, 'handleFinished')
        .mockResolvedValue(success(undefined));

      const dynamicIpnPayload: NowPaymentsIpnPayload = {
        payment_id: '99887766',
        payment_status: 'finished',
        invoice_id: '9999999999_dynamic_sdk_id', // NOT in static NOWPAYMENTS_TIERS
        order_id: 'sophia_usr_test123_1720000000',
        price_amount: 49,
        price_currency: 'usd',
      };

      await dispatchFinished(dynamicIpnPayload);

      // Must be called! Pre-fix behavior dropped this event with an early return no-op.
      expect(handleFinishedSpy).toHaveBeenCalledWith(dynamicIpnPayload);
      handleFinishedSpy.mockRestore();
    });

    it('safely warns and drops invoice when invoice_id is unknown AND order_id is missing', async () => {
      const handleFinishedSpy = vi
        .spyOn(subscriptionHandlers, 'handleFinished')
        .mockResolvedValue(success(undefined));

      const orphanedPayload: NowPaymentsIpnPayload = {
        payment_id: '11223344',
        payment_status: 'finished',
        invoice_id: 'unknown_static_invoice_with_no_order',
        price_amount: 10,
        price_currency: 'usd',
      };

      await dispatchFinished(orphanedPayload);

      expect(handleFinishedSpy).not.toHaveBeenCalled();
      handleFinishedSpy.mockRestore();
    });
  });

  describe('2. Mission Lifecycle & Terminal State Machine', () => {
    it('allows legal transition from running to failed (prevents infinite running lockup)', () => {
      expect(canTransition('running', 'failed')).toBe(true);
    });

    it('allows legal transition from running to cancelled', () => {
      expect(canTransition('running', 'cancelled')).toBe(true);
    });

    it('allows legal transition from paused to failed and cancelled', () => {
      expect(canTransition('paused', 'failed')).toBe(true);
      expect(canTransition('paused', 'cancelled')).toBe(true);
    });

    it('allows legal transition from review to failed and cancelled', () => {
      expect(canTransition('review', 'failed')).toBe(true);
      expect(canTransition('review', 'cancelled')).toBe(true);
    });

    it('allows recovery from failed to draft, planned, or running', () => {
      expect(canTransition('failed', 'draft')).toBe(true);
      expect(canTransition('failed', 'planned')).toBe(true);
      expect(canTransition('failed', 'running')).toBe(true);
    });
  });

  describe('3. Founder Bootstrap Security: Fail-Closed on Unverified Email', () => {
    beforeEach(() => {
      process.env.FOUNDER_EMAIL = 'founder@agencyos.network';
    });

    it('rejects elevation to founder when email matches but emailVerified is false', async () => {
      const result = await bootstrapFounderIfConfigured({
        id: 'usr_imposter_1',
        email: 'founder@agencyos.network',
        emailVerified: false,
      });

      expect(result).toBe(false);
    });

    it('rejects elevation to founder when emailVerified is null or undefined', async () => {
      const result = await bootstrapFounderIfConfigured({
        id: 'usr_imposter_2',
        email: 'founder@agencyos.network',
        emailVerified: null,
      });

      expect(result).toBe(false);
    });
  });

  describe('4. Diagnostics & Leak Prevention', () => {
    it('redacts all sensitive bearer tokens, API keys, and nested secrets', () => {
      const complexLog = JSON.stringify({
        level: 'error',
        message: 'Upstream call failed',
        headers: {
          authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature',
          'x-api-key': 'sk-ant-api03-abcdef1234567890abcdef123456',
        },
        connection: 'postgres://admin:secretPass123@db.prod:5432/main',
        context: 'User email: test@example.com with session: sess_token_9988776655',
      });

      const sanitized = redactSensitiveData(complexLog);

      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).not.toContain('sk-ant-api03-abcdef1234567890abcdef123456');
      expect(sanitized).not.toContain('secretPass123');
      expect(sanitized).not.toContain('test@example.com');
      expect(sanitized).toContain('[REDACTED]');
    });
  });

  describe('5. Zero-Dollar Upgrade Prevention (CWE-285)', () => {
    it('provisionTierChange rejects upgrades and requires verified payment checkout', async () => {
      const { provisionTierChange } = await import('@/land/billing/tier-change-provisioner');
      const result = await provisionTierChange({
        userId: 'usr_test_upgrade',
        orgId: 'org_test_upgrade',
        currentTier: 'BASIC',
        targetTier: 'ENTERPRISE',
        timing: 'immediate',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('upgrade_requires_payment');
    });
  });

  describe('6. Cross-Tenant IDOR & Workspace Isolation (Fail-Closed)', () => {
    function mockDbWithMembership(row: { role?: string } | null) {
      return {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(row),
          }),
        }),
      } as unknown as import('@/seed/db/client').D1Database;
    }

    it('denies access when user is not a member of the workspace (cross-tenant IDOR defense)', async () => {
      const { verifyWorkspaceAccess } = await import('@/seed/auth/workspace-access');
      const db = mockDbWithMembership(null);

      const hasAccess = await verifyWorkspaceAccess('ws_tenant_alpha', 'usr_tenant_beta', db);
      expect(hasAccess).toBe(false);
    });

    it('fails closed when workspaceId or userId is empty or missing', async () => {
      const { verifyWorkspaceAccess } = await import('@/seed/auth/workspace-access');
      const db = mockDbWithMembership({ role: 'OWNER' });

      expect(await verifyWorkspaceAccess('', 'usr_tenant_beta', db)).toBe(false);
      expect(await verifyWorkspaceAccess('ws_tenant_alpha', '', db)).toBe(false);
    });

    it('requireWorkspaceAccess throws WorkspaceAccessDeniedError (HTTP 403) on unauthenticated/cross-tenant access', async () => {
      const { requireWorkspaceAccess, WorkspaceAccessDeniedError } = await import('@/seed/auth/workspace-access');
      const db = mockDbWithMembership(null);

      await expect(requireWorkspaceAccess('ws_tenant_alpha', 'usr_unauthorized', db)).rejects.toThrow(
        WorkspaceAccessDeniedError
      );
    });

    it('requireWorkspaceRole throws InsufficientWorkspaceRoleError when member role is below required threshold', async () => {
      const { requireWorkspaceRole, InsufficientWorkspaceRoleError } = await import('@/seed/auth/workspace-access');
      const db = mockDbWithMembership({ role: 'VIEWER' });

      await expect(requireWorkspaceRole('ws_tenant_alpha', 'usr_viewer', 'ADMIN', db)).rejects.toThrow(
        InsufficientWorkspaceRoleError
      );
    });

    it('grants access when user has valid membership role in target workspace', async () => {
      const { verifyWorkspaceAccess, requireWorkspaceAccess } = await import('@/seed/auth/workspace-access');
      const db = mockDbWithMembership({ role: 'ADMIN' });

      const hasAccess = await verifyWorkspaceAccess('ws_tenant_alpha', 'usr_admin', db);
      expect(hasAccess).toBe(true);

      const membership = await requireWorkspaceAccess('ws_tenant_alpha', 'usr_admin', db);
      expect(membership.role).toBe('ADMIN');
    });
  });
});
