import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { NextRequest } from 'next/server';
import type { D1Database } from '@cloudflare/workers-types';
import type { EInvoice } from '@/seed/types/enterprise-billing';

vi.mock('@/seed/db/client', () => ({
  getD1: vi.fn(),
}));

vi.mock('@/seed/auth/better-auth-session', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/seed/auth/is-user-admin', () => ({
  isUserAdminWithRole: vi.fn(),
}));

vi.mock('@/tree/billing/invoice-generator', () => ({
  getInvoiceById: vi.fn(),
  generateInvoiceHtml: vi.fn(() => '<html><body>TAX INVOICE INV-2026-00001</body></html>'),
}));

import { getD1 } from '@/seed/db/client';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { isUserAdminWithRole } from '@/seed/auth/is-user-admin';
import { getInvoiceById } from '@/tree/billing/invoice-generator';

describe('GET /api/invoices/[id]/view', () => {
  const mockDb = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue({ role: 'owner' }),
      }),
    }),
  } as unknown as D1Database;

  const mockInvoice: EInvoice = {
    id: 'inv_test_1',
    invoiceNumber: 'INV-2026-00001',
    orgId: 'org_test_123',
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
    status: 'paid',
    pdfR2Key: null,
    paidAt: 1718000000,
    createdAt: 1718000000,
    updatedAt: 1718000000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getD1).mockResolvedValue(mockDb);
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: 'user_123',
      email: 'user@acme.com',
      role: 'user',
    } as unknown as Awaited<ReturnType<typeof getCurrentUser>>);
    vi.mocked(isUserAdminWithRole).mockResolvedValue({ isAdmin: true, dbRole: 'admin' });
    vi.mocked(getInvoiceById).mockResolvedValue(mockInvoice);
  });

  it('returns 401 when user is not authenticated', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/invoices/inv_test_1/view');
    const res = await GET(req, { params: Promise.resolve({ id: 'inv_test_1' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when invoice is not found', async () => {
    vi.mocked(getInvoiceById).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/invoices/inv_missing/view');
    const res = await GET(req, { params: Promise.resolve({ id: 'inv_missing' }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 and renders HTML invoice when authorized', async () => {
    const req = new NextRequest('http://localhost/api/invoices/inv_test_1/view?locale=en');
    const res = await GET(req, { params: Promise.resolve({ id: 'inv_test_1' }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const body = await res.text();
    expect(body).toContain('TAX INVOICE');
  });

  it('returns 403 when user is neither admin nor member of the invoice organization', async () => {
    vi.mocked(isUserAdminWithRole).mockResolvedValue({ isAdmin: false, dbRole: 'user' });
    const mockDbForbidden = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null), // No membership
        }),
      }),
    } as unknown as D1Database;
    vi.mocked(getD1).mockResolvedValue(mockDbForbidden);

    const req = new NextRequest('http://localhost/api/invoices/inv_test_1/view');
    const res = await GET(req, { params: Promise.resolve({ id: 'inv_test_1' }) });
    expect(res.status).toBe(403);
  });
});
