import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateVietnameseTaxId,
  generateInvoiceNumber,
  generateInvoiceHtml,
  escapeHtml,
  createInvoiceRecord,
  getInvoiceById,
  getInvoicesByOrg,
  updateInvoiceStatus,
  markInvoicePaid,
} from '../invoice-generator';
import type { D1Database } from '@cloudflare/workers-types';
import type { EInvoice, CreateInvoiceInput } from '@/seed/types/enterprise-billing';

describe('tree/billing/invoice-generator', () => {
  describe('validateVietnameseTaxId', () => {
    it('validates 10-digit enterprise MST', () => {
      const res = validateVietnameseTaxId('0317894562');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('0317894562');
    });

    it('validates 13-character branch MST with hyphen', () => {
      const res = validateVietnameseTaxId('0101234567-001');
      expect(res.valid).toBe(true);
      expect(res.normalized).toBe('0101234567-001');
    });

    it('rejects invalid MST formats', () => {
      expect(validateVietnameseTaxId('12345').valid).toBe(false);
      expect(validateVietnameseTaxId('031789456A').valid).toBe(false);
      expect(validateVietnameseTaxId('0101234567-1').valid).toBe(false);
      expect(validateVietnameseTaxId('').valid).toBe(false);
      expect(validateVietnameseTaxId(null as unknown as string).valid).toBe(false);
    });
  });

  describe('generateInvoiceNumber', () => {
    it('generates compliant invoice number format (INV-YYYY-XXXXX)', () => {
      const num = generateInvoiceNumber();
      expect(num).toMatch(/^INV-\d{4}-\d{5}$/);
    });

    it('formats sequential numbers correctly', () => {
      const date = new Date('2026-06-15T00:00:00Z');
      const num = generateInvoiceNumber(7, date);
      expect(num).toBe('INV-2026-00007');
    });
  });

  describe('escapeHtml', () => {
    it('escapes &, <, >, ", and \' characters correctly', () => {
      expect(escapeHtml('<script>alert("XSS & \'attack\'")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS &amp; &#39;attack&#39;&quot;)&lt;/script&gt;',
      );
    });

    it('returns empty string for null, undefined, or empty string', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
      expect(escapeHtml('')).toBe('');
    });

    it('preserves clean alphanumeric and safe punctuation strings', () => {
      expect(escapeHtml('Acme Corp 123')).toBe('Acme Corp 123');
      expect(escapeHtml('INV-2026-00001')).toBe('INV-2026-00001');
    });
  });

  describe('generateInvoiceHtml', () => {
    const mockInvoice: EInvoice = {
      id: 'inv_test123',
      invoiceNumber: 'INV-2026-00100',
      orgId: 'org_acme',
      subaccountId: 'sub_brand_1',
      tier: 'ENTERPRISE',
      billingCycle: 'annual',
      amountCents: 799000,
      currency: 'USD',
      fxRate: 1.0,
      taxId: 'US-EIN-12-3456789',
      legalName: 'Acme Global Ventures LLC',
      billingAddress: '100 Market St, Suite 500, San Francisco, CA 94105',
      vatRate: 0.0,
      vatAmountCents: 0,
      totalAmountCents: 799000,
      taxFormType: 'W9',
      status: 'paid',
      pdfR2Key: null,
      paidAt: 1718000000,
      createdAt: 1717900000,
      updatedAt: 1718000000,
    };

    it('renders responsive printable HTML in English', () => {
      const html = generateInvoiceHtml(mockInvoice, 'en');
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('TAX INVOICE');
      expect(html).toContain('INV-2026-00100');
      expect(html).toContain('Acme Global Ventures LLC');
      expect(html).toContain('US-EIN-12-3456789');
      expect(html).toContain('W9');
      expect(html).toContain('W-9');
      expect(html).toContain('Paid');
      expect(html).toContain('@media print');
      expect(html).toContain('window.print()');
    });

    it('renders bilingual Vietnamese HTML with domestic VAT breakdown', () => {
      const vnInvoice: EInvoice = {
        ...mockInvoice,
        currency: 'VND',
        amountCents: 5000000000, // 50,000,000 VND
        vatRate: 0.10,
        vatAmountCents: 500000000, // 5,000,000 VND
        totalAmountCents: 5500000000, // 55,000,000 VND
        taxId: '0317894562',
        legalName: 'Công Ty TNHH Công Nghệ Sáng Tạo Việt Nam',
        taxFormType: 'NONE',
        status: 'issued',
      };

      const html = generateInvoiceHtml(vnInvoice, 'vi');
      expect(html).toContain('HÓA ĐƠN ĐIỆN TỬ');
      expect(html).toContain('Công Ty TNHH Công Nghệ Sáng Tạo Việt Nam');
      expect(html).toContain('0317894562');
      expect(html).toContain('Thuế GTGT (VAT 10%)');
      expect(html).toContain('Cộng tiền hàng');
      expect(html).toContain('Đã phát hành');
      expect(html).toContain('Mã chứng từ đối soát');
    });

    it('renders W-8BEN compliance certificate notice for international non-US entity', () => {
      const w8Invoice: EInvoice = {
        ...mockInvoice,
        taxFormType: 'W8_BEN',
      };

      const html = generateInvoiceHtml(w8Invoice, 'en');
      expect(html).toContain('Form W-8BEN');
    });
  });

  describe('D1 Database Persistence', () => {
    // In-memory mock D1 store
    const store = new Map<string, Record<string, unknown>>();

    const createMockDb = (): D1Database => {
      return {
        prepare: (query: string) => {
          let boundParams: unknown[] = [];
          return {
            bind: (...params: unknown[]) => {
              boundParams = params;
              return {
                run: async () => {
                  if (query.startsWith('INSERT INTO invoices')) {
                    const row: Record<string, unknown> = {
                      id: boundParams[0],
                      invoice_number: boundParams[1],
                      org_id: boundParams[2],
                      subaccount_id: boundParams[3],
                      tier: boundParams[4],
                      billing_cycle: boundParams[5],
                      amount_cents: boundParams[6],
                      currency: boundParams[7],
                      fx_rate: boundParams[8],
                      tax_id: boundParams[9],
                      legal_name: boundParams[10],
                      billing_address: boundParams[11],
                      vat_rate: boundParams[12],
                      vat_amount_cents: boundParams[13],
                      total_amount_cents: boundParams[14],
                      tax_form_type: boundParams[15],
                      status: boundParams[16],
                      pdf_r2_key: boundParams[17],
                      paid_at: boundParams[18],
                      created_at: boundParams[19],
                      updated_at: boundParams[20],
                    };
                    store.set(row.id as string, row);
                    return { success: true };
                  }
                  if (query.startsWith('UPDATE invoices')) {
                    // UPDATE invoices SET status = ?1, paid_at = COALESCE(?2, paid_at), updated_at = ?3 WHERE id = ?4
                    const status = boundParams[0];
                    const paidAt = boundParams[1];
                    const updatedAt = boundParams[2];
                    const id = boundParams[3] as string;
                    const existing = store.get(id);
                    if (existing) {
                      existing.status = status;
                      if (paidAt !== null && paidAt !== undefined) {
                        existing.paid_at = paidAt;
                      }
                      existing.updated_at = updatedAt;
                    }
                    return { success: true };
                  }
                  return { success: true };
                },
                first: async <T>() => {
                  if (query.includes('SELECT * FROM invoices WHERE id = ?1')) {
                    const id = boundParams[0] as string;
                    return (store.get(id) ?? null) as T;
                  }
                  return null as T;
                },
                all: async <T>() => {
                  if (query.includes('SELECT * FROM invoices WHERE org_id = ?1')) {
                    const orgId = boundParams[0] as string;
                    const rows = Array.from(store.values()).filter((r) => r.org_id === orgId);
                    return { results: rows as T[] };
                  }
                  return { results: [] };
                },
              };
            },
          };
        },
      } as unknown as D1Database;
    };

    let mockDb: D1Database;

    beforeEach(() => {
      store.clear();
      mockDb = createMockDb();
    });

    it('creates an invoice record with calculated VAT and total amounts', async () => {
      const input: CreateInvoiceInput = {
        orgId: 'org_enterprise_1',
        tier: 'ENTERPRISE',
        billingCycle: 'annual',
        amountCents: 799000,
        currency: 'VND',
        legalName: 'Sophia Agency Vietnam',
        billingAddress: 'Ho Chi Minh City',
        taxId: '0317894562',
      };

      const invoice = await createInvoiceRecord(mockDb, input);
      expect(invoice.id).toMatch(/^inv_/);
      expect(invoice.invoiceNumber).toMatch(/^INV-\d{4}-\d{5}$/);
      expect(invoice.orgId).toBe('org_enterprise_1');
      expect(invoice.status).toBe('draft');
      expect(invoice.currency).toBe('VND');

      // Default VAT for VND is 10% (0.10)
      expect(invoice.vatRate).toBe(0.10);
      expect(invoice.vatAmountCents).toBe(79900); // 10% of 799000
      expect(invoice.totalAmountCents).toBe(878900); // 799000 + 79900
    });

    it('creates zero VAT invoice when vatRate = 0.0', async () => {
      const input: CreateInvoiceInput = {
        orgId: 'org_us_1',
        tier: 'STARTER',
        billingCycle: 'monthly',
        amountCents: 19900,
        currency: 'USD',
        vatRate: 0.0,
        legalName: 'Global Client LLC',
        billingAddress: 'New York, NY',
      };

      const invoice = await createInvoiceRecord(mockDb, input);
      expect(invoice.vatRate).toBe(0.0);
      expect(invoice.vatAmountCents).toBe(0);
      expect(invoice.totalAmountCents).toBe(19900);
    });

    it('retrieves invoice by ID and lists invoices by organization', async () => {
      const inv1 = await createInvoiceRecord(mockDb, {
        orgId: 'org_batch',
        tier: 'STARTER',
        amountCents: 19900,
        legalName: 'Client One',
        billingAddress: 'Address 1',
      });

      const inv2 = await createInvoiceRecord(mockDb, {
        orgId: 'org_batch',
        tier: 'CREATOR',
        amountCents: 39900,
        legalName: 'Client One',
        billingAddress: 'Address 1',
      });

      const found = await getInvoiceById(mockDb, inv1.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(inv1.id);
      expect(found?.amountCents).toBe(19900);

      const missing = await getInvoiceById(mockDb, 'inv_nonexistent');
      expect(missing).toBeNull();

      const orgInvoices = await getInvoicesByOrg(mockDb, 'org_batch');
      expect(orgInvoices.length).toBe(2);
      expect(orgInvoices.map((i) => i.id)).toContain(inv1.id);
      expect(orgInvoices.map((i) => i.id)).toContain(inv2.id);
    });

    it('updates invoice status and marks invoice paid', async () => {
      const invoice = await createInvoiceRecord(mockDb, {
        orgId: 'org_status',
        tier: 'PRO',
        amountCents: 49900,
        legalName: 'Test Corp',
        billingAddress: 'San Francisco',
      });

      expect(invoice.status).toBe('draft');

      const issued = await updateInvoiceStatus(mockDb, invoice.id, 'issued');
      expect(issued?.status).toBe('issued');

      const paid = await markInvoicePaid(mockDb, invoice.id, 1720000000, 'PAYOS', 'ref_123');
      expect(paid?.status).toBe('paid');
      expect(paid?.paidAt).toBe(1720000000);
    });
  });
});
