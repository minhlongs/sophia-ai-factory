import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createInvoiceAction,
  getInvoicesByOrgAction,
  getInvoiceByIdAction,
  issueInvoiceAction,
  markInvoicePaidAction,
} from '../enterprise-invoice-actions';
import type { D1Database } from '@cloudflare/workers-types';
import type { EInvoice, CreateInvoiceInput } from '@/seed/types/enterprise-billing';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: vi.fn(),
}));

vi.mock('@/seed/db/get-user-tier', () => ({
  getUserTier: vi.fn(),
}));

vi.mock('@/tree/billing/invoice-generator', () => ({
  createInvoiceRecord: vi.fn(),
  getInvoiceById: vi.fn(),
  getInvoicesByOrg: vi.fn(),
  updateInvoiceStatus: vi.fn(),
  markInvoicePaid: vi.fn(),
  validateVietnameseTaxId: vi.fn((taxId: string) => ({
    valid: taxId === '0317894562',
    normalized: taxId,
    error: taxId === '0317894562' ? undefined : 'Invalid tax ID',
  })),
}));

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getUserTier } from '@/seed/db/get-user-tier';
import {
  createInvoiceRecord,
  getInvoiceById,
  getInvoicesByOrg,
  updateInvoiceStatus,
  markInvoicePaid,
} from '@/tree/billing/invoice-generator';

describe('land/billing/enterprise-invoice-actions', () => {
  const mockOrgId = 'org_test_123';
  const mockUserId = 'user_123';

  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ role: 'owner' }),
      }),
    }),
  } as unknown as D1Database;

  const mockInvoice: EInvoice = {
    id: 'inv_abc',
    invoiceNumber: 'INV-2026-00001',
    orgId: mockOrgId,
    subaccountId: null,
    tier: 'ENTERPRISE',
    billingCycle: 'annual',
    amountCents: 799000,
    currency: 'USD',
    fxRate: 1.0,
    taxId: null,
    legalName: 'Acme Corp',
    billingAddress: '123 Market St',
    vatRate: 0.0,
    vatAmountCents: 0,
    totalAmountCents: 799000,
    taxFormType: 'NONE',
    status: 'draft',
    pdfR2Key: null,
    paidAt: null,
    createdAt: 1718000000,
    updatedAt: 1718000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getD1).mockResolvedValue(mockDb);
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: mockUserId,
      email: 'admin@acme.com',
      role: 'user',
    } as unknown as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(isUserAdminWithRole).mockResolvedValue({ isAdmin: true, dbRole: 'admin' });
    vi.mocked(getUserTier).mockResolvedValue('ENTERPRISE');
  });

  describe('createInvoiceAction', () => {
    it('returns UNAUTHORIZED when no user session exists', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      const input: CreateInvoiceInput = {
        orgId: mockOrgId,
        tier: 'ENTERPRISE',
        amountCents: 799000,
        legalName: 'Acme Corp',
        billingAddress: '123 Market St',
      };

      const res = await createInvoiceAction(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('creates invoice when user has permission', async () => {
      vi.mocked(createInvoiceRecord).mockResolvedValue(mockInvoice);

      const input: CreateInvoiceInput = {
        orgId: mockOrgId,
        tier: 'ENTERPRISE',
        amountCents: 799000,
        legalName: 'Acme Corp',
        billingAddress: '123 Market St',
      };

      const res = await createInvoiceAction(input);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.id).toBe('inv_abc');
        expect(res.value.legalName).toBe('Acme Corp');
      }
    });

    it('rejects creation when Vietnamese tax ID is invalid', async () => {
      const input: CreateInvoiceInput = {
        orgId: mockOrgId,
        tier: 'ENTERPRISE',
        amountCents: 50000000,
        currency: 'VND',
        legalName: 'Invalid Co',
        billingAddress: 'HCM',
        taxId: 'INVALID_MST',
      };

      const res = await createInvoiceAction(input);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('INVALID_TAX_ID');
      }
    });
  });

  describe('getInvoicesByOrgAction & getInvoiceByIdAction', () => {
    it('retrieves invoices by org', async () => {
      vi.mocked(getInvoicesByOrg).mockResolvedValue([mockInvoice]);

      const res = await getInvoicesByOrgAction(mockOrgId);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.length).toBe(1);
        expect(res.value[0].id).toBe('inv_abc');
      }
    });

    it('retrieves invoice by ID', async () => {
      vi.mocked(getInvoiceById).mockResolvedValue(mockInvoice);

      const res = await getInvoiceByIdAction('inv_abc');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.invoiceNumber).toBe('INV-2026-00001');
      }
    });

    it('returns NOT_FOUND when invoice does not exist', async () => {
      vi.mocked(getInvoiceById).mockResolvedValue(null);

      const res = await getInvoiceByIdAction('inv_missing');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('issueInvoiceAction & markInvoicePaidAction', () => {
    it('issues a draft invoice', async () => {
      vi.mocked(getInvoiceById).mockResolvedValue(mockInvoice);
      vi.mocked(updateInvoiceStatus).mockResolvedValue({
        ...mockInvoice,
        status: 'issued',
      });

      const res = await issueInvoiceAction('inv_abc');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('issued');
      }
    });

    it('marks an invoice as paid', async () => {
      vi.mocked(getInvoiceById).mockResolvedValue(mockInvoice);
      vi.mocked(markInvoicePaid).mockResolvedValue({
        ...mockInvoice,
        status: 'paid',
        paidAt: 1719000000,
      });

      const res = await markInvoicePaidAction('inv_abc', 'PAYOS', 'pay_123');
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value.status).toBe('paid');
        expect(res.value.paidAt).toBe(1719000000);
      }
    });
  });
});
