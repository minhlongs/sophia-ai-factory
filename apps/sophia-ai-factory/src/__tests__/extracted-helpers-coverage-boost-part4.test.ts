/**
 * Targeted branch coverage suite part 4 (< 180 LOC).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tryReuseExistingSandbox } from '@/tree/sales/sandbox/sandbox-reuse-helper';
import { scoreAuthority } from '@/tree/sales/bant/authority-evaluator';
import { resolveAttributionTouchpoint } from '@/land/affiliates/closed-loop-touchpoint-resolver';
import type { D1Database } from '@/seed/db/client';

vi.mock('@/tree/organizations/subaccount-repo', () => ({
  getSubaccountById: vi.fn(),
}));
vi.mock('@/tree/sales/enterprise-deal-repo', () => ({
  updateEnterpriseDeal: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

describe('extracted-helpers-coverage-boost-part4', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('tryReuseExistingSandbox', () => {
    it('returns null when deal has no sandboxSubaccountId or subaccount not found', async () => {
      const { getSubaccountById } = await import('@/tree/organizations/subaccount-repo');

      expect(await tryReuseExistingSandbox({
        db: {} as D1Database,
        deal: { id: 'd1', dealStage: 'new_lead' } as never,
        demoMcu: 1000, expiresAt: 999999, secret: 's'.repeat(32), baseUrl: 'https://test',
      })).toBeNull();

      vi.mocked(getSubaccountById).mockResolvedValueOnce(null);
      expect(await tryReuseExistingSandbox({
        db: {} as D1Database,
        deal: { id: 'd1', sandboxSubaccountId: 'sub-miss', dealStage: 'new_lead' } as never,
        demoMcu: 1000, expiresAt: 999999, secret: 's'.repeat(32), baseUrl: 'https://test',
      })).toBeNull();
    });

    it('re-activates existing subaccount across qualified and closed_won deal stages', async () => {
      const { getSubaccountById } = await import('@/tree/organizations/subaccount-repo');
      vi.mocked(getSubaccountById).mockResolvedValue({
        id: 'sub-ok', name: 'Acme Sandbox', slug: 'acme-sub',
      } as never);

      const resQualified = await tryReuseExistingSandbox({
        db: {} as D1Database,
        deal: { id: 'd2', sandboxSubaccountId: 'sub-ok', dealStage: 'qualified' } as never,
        demoMcu: 1000, expiresAt: 999999, secret: 's'.repeat(32), baseUrl: 'https://test',
      });
      expect(resQualified?.subaccountId).toBe('sub-ok');

      const resClosed = await tryReuseExistingSandbox({
        db: {} as D1Database,
        deal: { id: 'd3', sandboxSubaccountId: 'sub-ok', dealStage: 'closed_won' } as never,
        demoMcu: 1000, expiresAt: 999999, secret: 's'.repeat(32), baseUrl: 'https://test',
      });
      expect(resClosed?.slug).toBe('acme-sub');
    });
  });

  describe('scoreAuthority', () => {
    it('scores director, manager, IC, and unspecified titles', () => {
      expect(scoreAuthority({ jobTitle: 'Engineering Director', leadEmail: 'a@gmail.com' } as never).score).toBe(15);
      expect(scoreAuthority({ jobTitle: 'Project Manager', leadEmail: 'a@gmail.com' } as never).score).toBe(10);
      expect(scoreAuthority({ jobTitle: 'Software Engineer', leadEmail: 'a@gmail.com' } as never).score).toBe(4);
      expect(scoreAuthority({ jobTitle: '', leadEmail: 'a@acme.io', isCorporateEmail: true } as never).score).toBe(5);
    });
  });

  describe('resolveAttributionTouchpoint', () => {
    it('handles null db, expired token, active partnerCode fallback, and no match', async () => {
      const { getD1 } = await import('@/seed/db/client');

      vi.mocked(getD1).mockResolvedValueOnce(null as never);
      expect((await resolveAttributionTouchpoint({ partnerCode: 'P1' })).attributed).toBe(false);

      // Expired token -> falls through to partnerCode match
      const firstFn = vi.fn()
        .mockResolvedValueOnce({ id: 'r1', partner_id: 'p1', partner_code: 'P1', created_at: 1000 })
        .mockResolvedValueOnce({ id: 'p1', partner_code: 'P1' });
      vi.mocked(getD1).mockResolvedValueOnce({
        prepare: () => ({ bind: () => ({ first: firstFn }) }),
      } as never);
      const resPartner = await resolveAttributionTouchpoint({ attributionToken: 'tok-old', partnerCode: 'P1' });
      expect(resPartner.attributed).toBe(true);
      expect(resPartner.partnerId).toBe('p1');


      // Partner code not found -> attributed: false
      vi.mocked(getD1).mockResolvedValueOnce({
        prepare: () => ({ bind: () => ({ first: async () => null }) }),
      } as never);
      expect((await resolveAttributionTouchpoint({ partnerCode: 'NONE' })).attributed).toBe(false);
    });
  });
});
