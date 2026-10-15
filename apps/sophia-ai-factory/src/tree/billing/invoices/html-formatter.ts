/**
 * Bilingual Print-Optimized HTML Invoice Document Generator
 *
 * @module tree/billing/invoices/html-formatter
 */

import type { EInvoice } from '@/seed/types/enterprise-billing';
import { formatCurrency } from '../fx-converter';
import { escapeHtml } from './escape-html';
import { getInvoiceCss } from './html-styles';

function resolveTaxFormNote(taxFormType: EInvoice['taxFormType'], isVi: boolean): string {
  if (taxFormType === 'W8_BEN') {
    return 'Entity certified as non-US resident person/entity under Form W-8BEN treaty exemption.';
  }
  if (taxFormType === 'W9') {
    return 'Entity certified with US Taxpayer Identification Number under Form W-9.';
  }
  return isVi
    ? 'Hóa đơn điện tử khởi tạo từ hệ thống Sophia AI Factory tuân thủ quy định thuế số và thương mại điện tử Việt Nam.'
    : 'Electronic VAT invoice issued by Sophia AI Factory under enterprise SaaS software license.';
}

const VI_LABELS = {
  docTitle: 'Hóa đơn Điện tử', printBtn: 'In hóa đơn / Lưu PDF', invoiceHeading: 'HÓA ĐƠN ĐIỆN TỬ',
  sellerHeading: 'Đơn vị phát hành (Seller)', sellerTaxIdLabel: 'Mã số thuế (MST)',
  customerHeading: 'Đơn vị mua hàng (Customer)', customerTaxIdLabel: 'Mã số thuế / MST',
  naText: 'Không áp dụng', taxFormLabel: 'Mẫu chứng từ thuế', subaccountLabel: 'Tài khoản phụ',
  issueDateLabel: 'Ngày phát hành', billingCycleLabel: 'Chu kỳ thanh toán',
  paymentDateLabel: 'Ngày thanh toán', unpaidText: 'Chưa thanh toán',
  descCol: 'Mô tả dịch vụ', qtyCol: 'Số lượng', unitPriceCol: 'Đơn giá', totalCol: 'Thành tiền',
  lineItemDesc: 'Quyền truy cập toàn diện tính năng cấp doanh nghiệp & hạn ngạch kết xuất video',
  subtotalLabel: 'Cộng tiền hàng', grandTotalLabel: 'Tổng tiền thanh toán',
  legalNoteHeading: 'Lưu ý pháp lý & Thuế', verificationRefLabel: 'Mã chứng từ đối soát',
  status: { draft: 'Bản nháp', issued: 'Đã phát hành', paid: 'Đã thanh toán', void: 'Đã hủy' },
} as const;

const EN_LABELS = {
  docTitle: 'Electronic Invoice', printBtn: 'Print Invoice / Save PDF', invoiceHeading: 'TAX INVOICE',
  sellerHeading: 'Seller', sellerTaxIdLabel: 'Tax ID',
  customerHeading: 'Customer', customerTaxIdLabel: 'Tax ID',
  naText: 'N/A', taxFormLabel: 'Tax Form', subaccountLabel: 'Subaccount',
  issueDateLabel: 'Issue Date', billingCycleLabel: 'Billing Cycle',
  paymentDateLabel: 'Payment Date', unpaidText: 'Unpaid',
  descCol: 'Description', qtyCol: 'Qty', unitPriceCol: 'Unit Price', totalCol: 'Total',
  lineItemDesc: 'Enterprise subscription license & compute allocation',
  subtotalLabel: 'Subtotal', grandTotalLabel: 'Total',
  legalNoteHeading: 'Legal & Tax Notes', verificationRefLabel: 'Verification Ref',
  status: { draft: 'Draft', issued: 'Issued', paid: 'Paid', void: 'Void' },
} as const;

/**
 * Generate clean, responsive, print-optimized HTML invoice document
 * with comprehensive bilingual labels (VI + EN).
 */
export function generateInvoiceHtml(invoice: EInvoice, locale: 'en' | 'vi' = 'vi'): string {
  const isVi = locale === 'vi';
  const L = isVi ? VI_LABELS : EN_LABELS;
  const localeTag = isVi ? 'vi-VN' : 'en-US';

  const subtotalFormatted = formatCurrency(invoice.amountCents, invoice.currency, localeTag);
  const vatFormatted = formatCurrency(invoice.vatAmountCents, invoice.currency, localeTag);
  const totalFormatted = formatCurrency(invoice.totalAmountCents, invoice.currency, localeTag);

  const dateOpts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
  const issueDate = new Date(invoice.createdAt * 1000).toLocaleDateString(localeTag, dateOpts);
  const paidDate = invoice.paidAt
    ? new Date(invoice.paidAt * 1000).toLocaleDateString(localeTag, dateOpts)
    : L.unpaidText;

  const statusLabel = L.status[invoice.status];
  const statusColor = { draft: '#64748b', issued: '#0284c7', paid: '#16a34a', void: '#dc2626' }[invoice.status];
  const vatPercentText = (invoice.vatRate * 100).toFixed(0);
  const vatRowLabel = isVi ? `Thuế GTGT (VAT ${vatPercentText}%)` : `VAT (${vatPercentText}%)`;
  const customerTaxIdText = escapeHtml(invoice.taxId) || L.naText;
  const subaccountHtml = invoice.subaccountId
    ? `<div class="entity-detail">${L.subaccountLabel}: ${escapeHtml(invoice.subaccountId)}</div>`
    : '';
  const taxNoteBody = resolveTaxFormNote(invoice.taxFormType, isVi);

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${L.docTitle} - ${escapeHtml(invoice.invoiceNumber)}</title>
  <style>${getInvoiceCss(statusColor)}</style>
</head>
<body>
  <div class="actions-bar">
    <button class="btn-print" onclick="window.print()">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
        <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
        <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
      </svg>
      ${L.printBtn}
    </button>
  </div>

  <div class="invoice-card">
    <div class="header-row">
      <div>
        <div class="brand-title">Sophia AI Factory</div>
        <div class="brand-sub">AgencyOS Network — Autonomous Video & Automation Engine</div>
      </div>
      <div class="invoice-badge-box">
        <div class="invoice-heading">${L.invoiceHeading}</div>
        <div class="invoice-number">${escapeHtml(invoice.invoiceNumber)}</div>
        <div class="status-badge">${statusLabel}</div>
      </div>
    </div>

    <div class="entity-grid">
      <div class="entity-col">
        <h4>${L.sellerHeading}</h4>
        <div class="entity-name">Sophia AI Factory Co., Ltd</div>
        <div class="entity-detail">${L.sellerTaxIdLabel}: 0317894562</div>
        <div class="entity-detail">Bitexco Financial Tower, District 1, Ho Chi Minh City, Vietnam</div>
        <div class="entity-detail">support@sophia.agencyos.network</div>
      </div>

      <div class="entity-col">
        <h4>${L.customerHeading}</h4>
        <div class="entity-name">${escapeHtml(invoice.legalName)}</div>
        <div class="entity-detail">${L.customerTaxIdLabel}: ${customerTaxIdText}</div>
        <div class="entity-detail">${L.taxFormLabel}: ${escapeHtml(invoice.taxFormType)}</div>
        <div class="entity-detail">${escapeHtml(invoice.billingAddress)}</div>
        ${subaccountHtml}
      </div>
    </div>

    <div class="meta-box">
      <div class="meta-item">
        <div class="label">${L.issueDateLabel}</div>
        <div class="val">${issueDate}</div>
      </div>
      <div class="meta-item">
        <div class="label">${L.billingCycleLabel}</div>
        <div class="val">${escapeHtml(invoice.billingCycle).toUpperCase()}</div>
      </div>
      <div class="meta-item">
        <div class="label">${L.paymentDateLabel}</div>
        <div class="val">${paidDate}</div>
      </div>
    </div>

    <table class="line-items">
      <thead>
        <tr>
          <th>${L.descCol}</th>
          <th style="width: 100px;">${L.qtyCol}</th>
          <th class="text-right" style="width: 140px;">${L.unitPriceCol}</th>
          <th class="text-right" style="width: 140px;">${L.totalCol}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Sophia AI Factory — Gói ${escapeHtml(invoice.tier)} (${escapeHtml(invoice.billingCycle)})</strong>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              ${L.lineItemDesc}
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
        <span>${L.subtotalLabel}:</span>
        <strong>${subtotalFormatted}</strong>
      </div>
      <div class="total-row">
        <span>${vatRowLabel}:</span>
        <strong>${vatFormatted}</strong>
      </div>
      <div class="total-row grand-total">
        <span>${L.grandTotalLabel}:</span>
        <span>${totalFormatted}</span>
      </div>
    </div>

    <div class="footer-note">
      <p><strong>${L.legalNoteHeading}:</strong></p>
      <p>${taxNoteBody}</p>
      <p style="margin-top: 4px;">
        ${L.verificationRefLabel}: ${escapeHtml(invoice.id)} • ${escapeHtml(invoice.invoiceNumber)}
      </p>
    </div>
  </div>
</body>
</html>`;
}
