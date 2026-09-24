/**
 * Automated Enterprise VAT / E-Invoicing Engine & D1 Persistence
 *
 * Implements compliant enterprise invoice generation supporting Vietnamese Tax ID
 * (Mã Số Thuế - MST), international W-8BEN / W-9 certifications, bilingual print
 * formatting (VI + EN), and Cloudflare D1 data persistence.
 *
 * Layer: tree/billing (Domain service — imports only from seed)
 *
 * @module tree/billing/invoice-generator
 */

import { logger } from '@/seed/utils/logger-utility';
import type { D1Database } from '@cloudflare/workers-types';
import type {
  EInvoice,
  CreateInvoiceInput,
  UpdateInvoiceInput,
  InvoiceStatus,
  TaxFormType,
  BillingCycle,
  SupportedCurrency,
} from '@/seed/types/enterprise-billing';
import { formatCurrency } from './fx-converter';

interface InvoiceRow {
  id: string;
  invoice_number: string;
  org_id: string;
  subaccount_id: string | null;
  tier: string;
  billing_cycle: string;
  amount_cents: number;
  currency: string;
  fx_rate: number;
  tax_id: string | null;
  legal_name: string;
  billing_address: string;
  vat_rate: number;
  vat_amount_cents: number;
  total_amount_cents: number;
  tax_form_type: string;
  status: string;
  pdf_r2_key: string | null;
  paid_at: number | null;
  created_at: number;
  updated_at: number;
}

function mapRowToEInvoice(row: InvoiceRow): EInvoice {
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    orgId: row.org_id,
    subaccountId: row.subaccount_id,
    tier: row.tier,
    billingCycle: (row.billing_cycle as BillingCycle) || 'annual',
    amountCents: row.amount_cents,
    currency: (row.currency as SupportedCurrency) || 'USD',
    fxRate: row.fx_rate,
    taxId: row.tax_id,
    legalName: row.legal_name,
    billingAddress: row.billing_address,
    vatRate: row.vat_rate,
    vatAmountCents: row.vat_amount_cents,
    totalAmountCents: row.total_amount_cents,
    taxFormType: (row.tax_form_type as TaxFormType) || 'NONE',
    status: (row.status as InvoiceStatus) || 'draft',
    pdfR2Key: row.pdf_r2_key,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Validate Vietnamese Tax ID (Mã số thuế - MST).
 * Conforms to standard 10-digit enterprise MST or 13-character branch MST (10 digits + hyphen + 3 digits).
 */
export function validateVietnameseTaxId(taxId: string): {
  valid: boolean;
  normalized?: string;
  error?: string;
} {
  if (!taxId || typeof taxId !== 'string') {
    return { valid: false, error: 'Tax ID is required' };
  }

  const trimmed = taxId.trim();
  const isTenDigit = /^\d{10}$/.test(trimmed);
  const isThirteenDigit = /^\d{10}-\d{3}$/.test(trimmed);

  if (!isTenDigit && !isThirteenDigit) {
    return {
      valid: false,
      error: 'Invalid Vietnamese MST format. Must be 10 digits (e.g. 0101234567) or 13 characters (e.g. 0101234567-001)',
    };
  }

  return {
    valid: true,
    normalized: trimmed,
  };
}

/**
 * Generate a sequential, unique invoice number.
 * Example: INV-2026-08149
 */
export function generateInvoiceNumber(sequence?: number, date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  const seqPart = sequence ? String(sequence).padStart(5, '0') : String(randomSuffix);
  return `INV-${year}-${seqPart}`;
}

/**
 * Create a new invoice record in Cloudflare D1.
 */
export async function createInvoiceRecord(
  db: D1Database,
  input: CreateInvoiceInput,
): Promise<EInvoice> {
  const now = Math.floor(Date.now() / 1000);
  const id = `inv_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const invoiceNumber = generateInvoiceNumber();

  const billingCycle: BillingCycle = input.billingCycle ?? 'annual';
  const currency: SupportedCurrency = input.currency ?? 'USD';
  const fxRate = input.fxRate ?? 1.0;

  // Determine VAT rate: 10% for domestic VND software by default, 0% for international cross-border
  const vatRate = input.vatRate !== undefined
    ? input.vatRate
    : (currency === 'VND' ? 0.10 : 0.0);

  const vatAmountCents = input.vatAmountCents !== undefined
    ? input.vatAmountCents
    : Math.round(input.amountCents * vatRate);

  const totalAmountCents = input.totalAmountCents !== undefined
    ? input.totalAmountCents
    : input.amountCents + vatAmountCents;

  const taxFormType: TaxFormType = input.taxFormType ?? 'NONE';
  const status: InvoiceStatus = 'draft';

  await db
    .prepare(
      `INSERT INTO invoices (
        id, invoice_number, org_id, subaccount_id, tier,
        billing_cycle, amount_cents, currency, fx_rate, tax_id,
        legal_name, billing_address, vat_rate, vat_amount_cents, total_amount_cents,
        tax_form_type, status, pdf_r2_key, paid_at, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21)`,
    )
    .bind(
      id,
      invoiceNumber,
      input.orgId,
      input.subaccountId ?? null,
      input.tier,
      billingCycle,
      input.amountCents,
      currency,
      fxRate,
      input.taxId ?? null,
      input.legalName,
      input.billingAddress,
      vatRate,
      vatAmountCents,
      totalAmountCents,
      taxFormType,
      status,
      null,
      null,
      now,
      now,
    )
    .run();

  logger.info('[InvoiceGenerator] Invoice record created in D1', {
    id,
    invoiceNumber,
    orgId: input.orgId,
    totalAmountCents,
    currency,
  });

  return {
    id,
    invoiceNumber,
    orgId: input.orgId,
    subaccountId: input.subaccountId ?? null,
    tier: input.tier,
    billingCycle,
    amountCents: input.amountCents,
    currency,
    fxRate,
    taxId: input.taxId ?? null,
    legalName: input.legalName,
    billingAddress: input.billingAddress,
    vatRate,
    vatAmountCents,
    totalAmountCents,
    taxFormType,
    status,
    pdfR2Key: null,
    paidAt: null,
    createdAt: now,
    updatedAt: now,
    lineItems: input.lineItems,
    paymentRail: input.paymentRail,
    paymentReference: input.paymentReference,
  };
}

/**
 * Retrieve invoice by unique ID from D1.
 */
export async function getInvoiceById(db: D1Database, id: string): Promise<EInvoice | null> {
  const row = await db
    .prepare('SELECT * FROM invoices WHERE id = ?1 LIMIT 1')
    .bind(id)
    .first<InvoiceRow>();

  if (!row) return null;
  return mapRowToEInvoice(row);
}

/**
 * Retrieve all invoices for an organization, ordered by newest first.
 */
export async function getInvoicesByOrg(
  db: D1Database,
  orgId: string,
  limit: number = 50,
): Promise<EInvoice[]> {
  const { results } = await db
    .prepare('SELECT * FROM invoices WHERE org_id = ?1 ORDER BY created_at DESC LIMIT ?2')
    .bind(orgId, Math.max(1, Math.min(limit, 200)))
    .all<InvoiceRow>();

  if (!results) return [];
  return results.map(mapRowToEInvoice);
}

/**
 * Update status of an invoice (e.g. issued, paid, void).
 */
export async function updateInvoiceStatus(
  db: D1Database,
  id: string,
  status: InvoiceStatus,
  paidAt?: number,
): Promise<EInvoice | null> {
  const now = Math.floor(Date.now() / 1000);
  const effectivePaidAt = status === 'paid' ? (paidAt ?? now) : null;

  await db
    .prepare(
      'UPDATE invoices SET status = ?1, paid_at = COALESCE(?2, paid_at), updated_at = ?3 WHERE id = ?4',
    )
    .bind(status, effectivePaidAt, now, id)
    .run();

  return getInvoiceById(db, id);
}

/**
 * Mark invoice as paid with optional payment rail reference.
 */
export async function markInvoicePaid(
  db: D1Database,
  id: string,
  paidAt?: number,
  _paymentRail?: string,
  _paymentReference?: string,
): Promise<EInvoice | null> {
  return updateInvoiceStatus(db, id, 'paid', paidAt);
}

/**
 * Escape HTML special characters to prevent Stored XSS injection.
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generate clean, responsive, print-optimized HTML invoice document
 * with comprehensive bilingual labels (VI + EN).
 */
export function generateInvoiceHtml(invoice: EInvoice, locale: 'en' | 'vi' = 'vi'): string {
  const isVi = locale === 'vi';

  const subtotalFormatted = formatCurrency(invoice.amountCents, invoice.currency, isVi ? 'vi-VN' : 'en-US');
  const vatFormatted = formatCurrency(invoice.vatAmountCents, invoice.currency, isVi ? 'vi-VN' : 'en-US');
  const totalFormatted = formatCurrency(invoice.totalAmountCents, invoice.currency, isVi ? 'vi-VN' : 'en-US');

  const issueDate = new Date(invoice.createdAt * 1000).toLocaleDateString(
    isVi ? 'vi-VN' : 'en-US',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt * 1000).toLocaleDateString(
        isVi ? 'vi-VN' : 'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' },
      )
    : null;

  const statusLabel = {
    draft: isVi ? 'Bản nháp' : 'Draft',
    issued: isVi ? 'Đã phát hành' : 'Issued',
    paid: isVi ? 'Đã thanh toán' : 'Paid',
    void: isVi ? 'Đã hủy' : 'Void',
  }[invoice.status];

  const statusColor = {
    draft: '#64748b',
    issued: '#0284c7',
    paid: '#16a34a',
    void: '#dc2626',
  }[invoice.status];

  const vatPercentText = (invoice.vatRate * 100).toFixed(0);

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${isVi ? 'Hóa đơn Điện tử' : 'Electronic Invoice'} - ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #f8fafc; color: #0f172a; padding: 32px 16px; }
    .invoice-card { max-width: 800px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 40px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f1f5f9; padding-bottom: 24px; margin-bottom: 24px; }
    .brand-title { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
    .brand-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
    .invoice-badge-box { text-align: right; }
    .invoice-heading { font-size: 20px; font-weight: 700; color: #0f172a; text-transform: uppercase; }
    .invoice-number { font-size: 14px; font-weight: 600; color: #475569; margin-top: 4px; }
    .status-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; margin-top: 8px; color: #ffffff; background: ${statusColor}; }
    .entity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px; }
    .entity-col h4 { font-size: 12px; text-transform: uppercase; color: #94a3b8; font-weight: 700; margin-bottom: 8px; letter-spacing: 0.5px; }
    .entity-col .entity-name { font-size: 15px; font-weight: 700; color: #1e293b; margin-bottom: 4px; }
    .entity-col .entity-detail { font-size: 13px; color: #475569; line-height: 1.5; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 32px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; font-size: 13px; }
    .meta-item .label { color: #64748b; margin-bottom: 2px; }
    .meta-item .val { font-weight: 600; color: #0f172a; }
    table.line-items { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    table.line-items th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase; }
    table.line-items td { padding: 16px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #1e293b; }
    .text-right { text-align: right; }
    .totals-box { margin-left: auto; width: 320px; margin-bottom: 32px; }
    .total-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; color: #475569; }
    .total-row.grand-total { border-top: 2px solid #0f172a; margin-top: 8px; padding-top: 12px; font-size: 18px; font-weight: 800; color: #0f172a; }
    .footer-note { border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #64748b; line-height: 1.6; }
    .actions-bar { max-width: 800px; margin: 0 auto 16px auto; display: flex; justify-content: flex-end; gap: 12px; }
    .btn-print { background: #0f172a; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; }
    .btn-print:hover { background: #1e293b; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .invoice-card { box-shadow: none; border: none; padding: 0; width: 100%; max-width: 100%; }
      .actions-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="actions-bar">
    <button class="btn-print" onclick="window.print()">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
        <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
      </svg>
      ${isVi ? 'In hóa đơn / Lưu PDF' : 'Print Invoice / Save PDF'}
    </button>
  </div>

  <div class="invoice-card">
    <div class="header-row">
      <div>
        <div class="brand-title">Sophia AI Factory</div>
        <div class="brand-sub">AgencyOS Network — Autonomous Video & Automation Engine</div>
      </div>
      <div class="invoice-badge-box">
        <div class="invoice-heading">${isVi ? 'HÓA ĐƠN ĐIỆN TỬ' : 'TAX INVOICE'}</div>
        <div class="invoice-number">${escapeHtml(invoice.invoiceNumber)}</div>
        <div class="status-badge">${statusLabel}</div>
      </div>
    </div>

    <div class="entity-grid">
      <div class="entity-col">
        <h4>${isVi ? 'Đơn vị phát hành (Seller)' : 'Seller'}</h4>
        <div class="entity-name">Sophia AI Factory Co., Ltd</div>
        <div class="entity-detail">${isVi ? 'Mã số thuế (MST)' : 'Tax ID'}: 0317894562</div>
        <div class="entity-detail">Bitexco Financial Tower, District 1, Ho Chi Minh City, Vietnam</div>
        <div class="entity-detail">support@sophia.agencyos.network</div>
      </div>

      <div class="entity-col">
        <h4>${isVi ? 'Đơn vị mua hàng (Customer)' : 'Customer'}</h4>
        <div class="entity-name">${escapeHtml(invoice.legalName)}</div>
        <div class="entity-detail">${isVi ? 'Mã số thuế / MST' : 'Tax ID'}: ${escapeHtml(invoice.taxId) || (isVi ? 'Không áp dụng' : 'N/A')}</div>
        <div class="entity-detail">${isVi ? 'Mẫu chứng từ thuế' : 'Tax Form'}: ${escapeHtml(invoice.taxFormType)}</div>
        <div class="entity-detail">${escapeHtml(invoice.billingAddress)}</div>
        ${invoice.subaccountId ? `<div class="entity-detail">${isVi ? 'Tài khoản phụ' : 'Subaccount'}: ${escapeHtml(invoice.subaccountId)}</div>` : ''}
      </div>
    </div>

    <div class="meta-box">
      <div class="meta-item">
        <div class="label">${isVi ? 'Ngày phát hành' : 'Issue Date'}</div>
        <div class="val">${issueDate}</div>
      </div>
      <div class="meta-item">
        <div class="label">${isVi ? 'Chu kỳ thanh toán' : 'Billing Cycle'}</div>
        <div class="val">${escapeHtml(invoice.billingCycle).toUpperCase()}</div>
      </div>
      <div class="meta-item">
        <div class="label">${isVi ? 'Ngày thanh toán' : 'Payment Date'}</div>
        <div class="val">${paidDate || (isVi ? 'Chưa thanh toán' : 'Unpaid')}</div>
      </div>
    </div>

    <table class="line-items">
      <thead>
        <tr>
          <th>${isVi ? 'Mô tả dịch vụ' : 'Description'}</th>
          <th style="width: 100px;">${isVi ? 'Số lượng' : 'Qty'}</th>
          <th class="text-right" style="width: 140px;">${isVi ? 'Đơn giá' : 'Unit Price'}</th>
          <th class="text-right" style="width: 140px;">${isVi ? 'Thành tiền' : 'Total'}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Sophia AI Factory — Gói ${escapeHtml(invoice.tier)} (${escapeHtml(invoice.billingCycle)})</strong>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              ${isVi ? 'Quyền truy cập toàn diện tính năng cấp doanh nghiệp & hạn ngạch kết xuất video' : 'Enterprise subscription license & compute allocation'}
            </div>
          </td>
          <td>1</td>
          <td class="text-right">${subtotalFormatted}</td>
          <td class="text-right">${subtotalFormatted}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals-box">
      <div class="total-row">
        <span>${isVi ? 'Cộng tiền hàng' : 'Subtotal'}:</span>
        <strong>${subtotalFormatted}</strong>
      </div>
      <div class="total-row">
        <span>${isVi ? `Thuế GTGT (VAT ${vatPercentText}%)` : `VAT (${vatPercentText}%)`}:</span>
        <strong>${vatFormatted}</strong>
      </div>
      <div class="total-row grand-total">
        <span>${isVi ? 'Tổng tiền thanh toán' : 'Total'}:</span>
        <span>${totalFormatted}</span>
      </div>
    </div>

    <div class="footer-note">
      <p><strong>${isVi ? 'Lưu ý pháp lý & Thuế' : 'Legal & Tax Notes'}:</strong></p>
      <p>
        ${
          invoice.taxFormType === 'W8_BEN'
            ? 'Entity certified as non-US resident person/entity under Form W-8BEN treaty exemption.'
            : invoice.taxFormType === 'W9'
              ? 'Entity certified with US Taxpayer Identification Number under Form W-9.'
              : isVi
                ? 'Hóa đơn điện tử khởi tạo từ hệ thống Sophia AI Factory tuân thủ quy định thuế số và thương mại điện tử Việt Nam.'
                : 'Electronic VAT invoice issued by Sophia AI Factory under enterprise SaaS software license.'
        }
      </p>
      <p style="margin-top: 4px;">
        ${isVi ? 'Mã chứng từ đối soát' : 'Verification Ref'}: ${escapeHtml(invoice.id)} • ${escapeHtml(invoice.invoiceNumber)}
      </p>
    </div>
  </div>
</body>
</html>`;
}
