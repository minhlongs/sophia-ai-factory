/**
 * Niche Video Server Actions Vitest Suite
 *
 * Verifies authentication enforcement, Zod payload validation,
 * regulatory compliance checks, and Inngest event dispatching.
 *
 * @module forest/actions/__tests__/niche-video-actions.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  previewNicheVideoPlanAction,
  dispatchNicheVideoCampaignAction,
  type CreateNicheVideoCampaignActionInput,
} from '../niche-video-actions';
import { getOpcGate1ReadinessAction } from '../opc-readiness-actions';
import * as authSession from '@/seed/auth/better-auth-session';
import { clearOrgIdCache } from '@/seed/auth/resolve-org-id';
import * as dbClient from '@/seed/db/client';
import { createFakeD1 } from '@/seed/testing/fake-d1-sqlite';
import { inngest } from '@/seed/inngest/client';
import { buildWorkspaceOfferId } from '@/tree/affiliate/offers/workspace-offer-upsert';

vi.mock('@/seed/auth/better-auth-session');
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
  createServerClient: vi.fn(() => ({})),
}));
vi.mock('@/seed/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ['evt_test_123'] }),
  },
}));

describe('Niche Video Server Actions', () => {
  const mockUser = {
    id: 'usr_growth_agency_99',
    email: 'creator@agencyos.network',
    tier: 'PREMIUM' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    clearOrgIdCache();
    vi.mocked(dbClient.getD1).mockResolvedValue(null as unknown as D1Database);
    vi.mocked(authSession.getCurrentUser).mockResolvedValue(
      mockUser as unknown as Awaited<ReturnType<typeof authSession.getCurrentUser>>,
    );
  });

  describe('previewNicheVideoPlanAction', () => {
    it('rejects unauthenticated requests with Unauthorized status', async () => {
      vi.mocked(authSession.getCurrentUser).mockResolvedValue(null);

      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'https://grsm.io/flowcraft',
      };

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('UNAUTHORIZED');
    });

    it('rejects payload with invalid URL schema', async () => {
      const payload = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'not-a-valid-http-url',
      } as unknown as CreateNicheVideoCampaignActionInput;

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('VALIDATION_ERROR');
    });

    it('rejects crypto campaign targeting banned Vietnam jurisdiction', async () => {
      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Bybit VIP',
        productUrl: 'https://bybit.com/register',
        jurisdiction: 'VN',
      };

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('VIETNAM_PROMOTIONAL_BAN');
      expect(result.error).toContain('Decree 52/2024');
    });

    it('successfully generates plan preview for SaaS campaign', async () => {
      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'FlowCraft AI',
        productUrl: 'https://grsm.io/flowcraft',
        targetAudience: 'Agency Founders',
        affiliateCode: 'SOPHIA_GROWTH',
        subId: 'yt_shorts_01',
        vanityCoupon: 'SAVE30',
        locale: 'en',
      };

      const result = await previewNicheVideoPlanAction(payload);
      expect(result.success).toBe(true);
      if (!result.success || !result.data) return;

      expect(result.data.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
      expect(result.data.blueprint.id).toBe('saas_problem_agitation_solution');
      expect(result.data.trackedUrl).toContain('ps_partner_key=SOPHIA_GROWTH');
      expect(result.data.caption).toContain('Exclusive Promo Code: SAVE30');
    });
  });

  describe('dispatchNicheVideoCampaignAction', () => {
    it('successfully plans campaign and dispatches Inngest event', async () => {
      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_fee_discount_signup_bonus',
        productName: 'Binance',
        productUrl: 'https://accounts.binance.com/register',
        jurisdiction: 'US',
        affiliateCode: 'DISCOUNT20',
        subId: 'reels_us_01',
        locale: 'en',
      };

      const result = await dispatchNicheVideoCampaignAction(payload);
      expect(result.success).toBe(true);
      if (!result.success || !result.data) return;

      expect(result.data.dispatched).toBe(true);
      expect(result.data.planId).toMatch(/^nvp_[a-f0-9]{16}$/);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'niche.video.campaign.requested',
          data: expect.objectContaining({
            userId: 'usr_growth_agency_99',
            niche: 'crypto_global',
            blueprintId: 'crypto_fee_discount_signup_bonus',
            productName: 'Binance',
          }),
        }),
      );
    });

    it('self-registers verified workspace offer, synchronously stages pending_ceo approval row in D1, and passes campaignId without approvalId to Inngest (D1)', async () => {
      const db = createFakeD1([
        `CREATE TABLE affiliate_offers (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'system',
          network_id TEXT NOT NULL DEFAULT 'direct',
          external_id TEXT,
          program_name TEXT,
          title TEXT,
          category TEXT,
          product_url TEXT,
          destination_url TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          commission_terms TEXT,
          niche TEXT,
          region TEXT,
          language TEXT,
          created_at INTEGER NOT NULL DEFAULT 1000,
          updated_at INTEGER NOT NULL DEFAULT 1000
        );`,
        `CREATE TABLE agent_campaign_approvals (
          id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
          niche TEXT NOT NULL, jurisdiction TEXT NOT NULL, approval_payload_hash TEXT NOT NULL,
          estimated_render_cost_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending_ceo',
          approved_by TEXT, approved_at INTEGER, invalidated_reason TEXT,
          payload_json TEXT, dispatch_json TEXT, expires_at INTEGER,
          revoked_by TEXT, revoked_at INTEGER, executed_at INTEGER, rejection_reason TEXT,
          created_at INTEGER NOT NULL
        );`,
      ]) as unknown as D1Database;
      vi.mocked(dbClient.getD1).mockResolvedValue(db);

      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'crypto_global',
        blueprintId: 'crypto_trading_bot_copy_trading',
        productName: 'Binance Global',
        productUrl: 'https://accounts.binance.com/register',
        commissionTerms: '20% Spot & Futures Fee Rebate Share',
        jurisdiction: 'US',
        affiliateCode: 'DISCOUNT20',
        subId: 'reels_us_01',
        locale: 'en',
      };

      const result = await dispatchNicheVideoCampaignAction(payload);
      expect(result.success).toBe(true);
      expect(result.data?.approvalId).toMatch(/^app_/);
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'niche.video.campaign.requested',
          data: expect.objectContaining({
            userId: 'usr_growth_agency_99',
            campaignId: result.data?.planId,
            offerId: buildWorkspaceOfferId(
              'usr_growth_agency_99',
              'crypto_global',
              'https://accounts.binance.com/register',
            ),
            termsVerified: true,
          }),
        }),
      );
      const sentEvent = vi.mocked(inngest.send).mock.calls[0]?.[0] as unknown as {
        data: Record<string, unknown>;
      };
      expect(sentEvent.data.approvalId).toBeUndefined();

      const approvalRow = await db
        .prepare(`SELECT id, status, campaign_id FROM agent_campaign_approvals WHERE tenant_id = ?`)
        .bind('usr_growth_agency_99')
        .first<{ id: string; status: string; campaign_id: string }>();
      expect(approvalRow?.id).toBe(result.data?.approvalId);
      expect(approvalRow?.status).toBe('pending_ceo');
      expect(approvalRow?.campaign_id).toBe(result.data?.planId);
    });

    it('preserves adopted campaignId across approval staging, idempotencyKey, and Inngest dispatch', async () => {
      const db = createFakeD1([
        `CREATE TABLE affiliate_offers (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL DEFAULT 'system',
          network_id TEXT NOT NULL DEFAULT 'direct',
          external_id TEXT,
          program_name TEXT,
          title TEXT,
          category TEXT,
          product_url TEXT,
          destination_url TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          commission_terms TEXT,
          niche TEXT,
          region TEXT,
          language TEXT,
          created_at INTEGER NOT NULL DEFAULT 1000,
          updated_at INTEGER NOT NULL DEFAULT 1000
        );`,
        `CREATE TABLE agent_campaign_approvals (
          id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
          niche TEXT NOT NULL, jurisdiction TEXT NOT NULL, approval_payload_hash TEXT NOT NULL,
          estimated_render_cost_cents INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending_ceo',
          approved_by TEXT, approved_at INTEGER, invalidated_reason TEXT,
          payload_json TEXT, dispatch_json TEXT, expires_at INTEGER,
          revoked_by TEXT, revoked_at INTEGER, executed_at INTEGER, rejection_reason TEXT,
          created_at INTEGER NOT NULL
        );`,
      ]) as unknown as D1Database;
      vi.mocked(dbClient.getD1).mockResolvedValue(db);

      const result = await dispatchNicheVideoCampaignAction({
        niche: 'crypto_global',
        blueprintId: 'crypto_trading_bot_copy_trading',
        productName: 'Binance Global',
        productUrl: 'https://accounts.binance.com/register',
        commissionTerms: '20% Spot & Futures Fee Rebate Share',
        jurisdiction: 'US',
        offerId: 'wvo_adopted_1',
        campaignId: 'camp_adopted_wvo_1',
      });

      expect(result.success).toBe(true);
      expect(result.data?.planId).toBe('camp_adopted_wvo_1');
      expect(inngest.send).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'niche.video.campaign.requested',
          data: expect.objectContaining({
            campaignId: 'camp_adopted_wvo_1',
            idempotencyKey: 'usr_growth_agency_99:camp_adopted_wvo_1',
          }),
        }),
      );
      const approvalRow = await db
        .prepare(`SELECT campaign_id FROM agent_campaign_approvals WHERE tenant_id = ?`)
        .bind('usr_growth_agency_99')
        .first<{ campaign_id: string }>();
      expect(approvalRow?.campaign_id).toBe('camp_adopted_wvo_1');
    });

    it('rejects dispatch when maxRenderCostCents exceeds the proposed Gate 1 vertical ceiling of 2500 cents ($25.00)', async () => {
      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'Linear App',
        productUrl: 'https://linear.app',
        maxRenderCostCents: 2600,
      };

      const result = await dispatchNicheVideoCampaignAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('BUDGET_CAP_EXCEEDED');
      expect(inngest.send).not.toHaveBeenCalled();
    });

    it('rejects dispatch when cumulative vertical reservations in D1 + new request exceed 2500 cents ($25.00)', async () => {
      const db = createFakeD1([
        `CREATE TABLE affiliate_execution_runs (
          id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
          offer_id TEXT, approval_id TEXT, idempotency_key TEXT NOT NULL,
          state TEXT NOT NULL DEFAULT 'render_queued', locale TEXT NOT NULL DEFAULT 'en',
          market TEXT, artifact_id TEXT, channel_id TEXT,
          reserved_cost_cents INTEGER NOT NULL DEFAULT 0, actual_cost_cents INTEGER,
          failure_reason TEXT, provider_job_id TEXT, render_attempts INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT 1000, updated_at INTEGER NOT NULL DEFAULT 1000
        );`,
      ]) as unknown as D1Database;
      await db
        .prepare(
          `INSERT INTO affiliate_execution_runs (id, tenant_id, campaign_id, idempotency_key, state, market, reserved_cost_cents)
           VALUES ('run_prev_1', 'usr_growth_agency_99', 'camp_saas_1', 'idem_1', 'render_queued', 'saas_global:GLOBAL', 2400)`,
        )
        .run();
      vi.mocked(dbClient.getD1).mockResolvedValue(db);

      const payload: CreateNicheVideoCampaignActionInput = {
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'Linear App',
        productUrl: 'https://linear.app',
        maxRenderCostCents: 250,
      };

      const result = await dispatchNicheVideoCampaignAction(payload);
      expect(result.success).toBe(false);
      expect(result.code).toBe('BUDGET_CAP_EXCEEDED');
      expect(result.error).toContain('Cumulative saas_global budget');
      expect(inngest.send).not.toHaveBeenCalled();
    });
  });

  describe('getOpcGate1ReadinessAction', () => {
    it('rejects unauthenticated requests with UNAUTHORIZED', async () => {
      vi.mocked(authSession.getCurrentUser).mockResolvedValue(null);
      const res = await getOpcGate1ReadinessAction();
      expect(res.success).toBe(false);
      expect(res.code).toBe('UNAUTHORIZED');
    });

    it('evaluations personal owner workspace readiness with zero secret exposure', async () => {
      const db = createFakeD1([
        `CREATE TABLE org_members (id TEXT PRIMARY KEY, org_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL);`,
        `CREATE TABLE publishing_channels (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, provider TEXT NOT NULL, access_token TEXT, status TEXT NOT NULL);`,
        `CREATE TABLE affiliate_offers (id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, status TEXT NOT NULL, product_url TEXT, destination_url TEXT, commission_terms TEXT, niche TEXT, region TEXT, category TEXT);`,
      ]) as unknown as D1Database;
      vi.mocked(dbClient.getD1).mockResolvedValue(db);

      const res = await getOpcGate1ReadinessAction();
      expect(res.success).toBe(true);
      expect(res.data?.workspaceId).toBe('usr_growth_agency_99');
      expect(res.data?.adminAuthorized).toBe(true);
    });

    it('fails closed with WORKSPACE_RESOLUTION_FAILED when D1 org_members or workspace_members query throws a real error (D2)', async () => {
      const brokenDb = {
        prepare: () => ({
          bind: () => ({
            first: () => Promise.reject(new Error('D1_ERROR: SQLITE_IOERR: disk I/O error')),
            all: () => Promise.reject(new Error('D1_ERROR: SQLITE_IOERR: disk I/O error')),
          }),
        }),
      } as unknown as D1Database;
      vi.mocked(dbClient.getD1).mockResolvedValue(brokenDb);

      const readinessRes = await getOpcGate1ReadinessAction();
      expect(readinessRes.success).toBe(false);
      expect(readinessRes.code).toBe('WORKSPACE_RESOLUTION_FAILED');

      const dispatchRes = await dispatchNicheVideoCampaignAction({
        niche: 'saas_global',
        blueprintId: 'saas_problem_agitation_solution',
        productName: 'Linear App',
        productUrl: 'https://linear.app',
      });
      expect(dispatchRes.success).toBe(false);
      expect(dispatchRes.code).toBe('WORKSPACE_RESOLUTION_FAILED');
      expect(inngest.send).not.toHaveBeenCalled();
    });
  });
});
