/**
 * Bilingual Print-Optimized HTML Invoice Document Generator
 *
 * @module tree/billing/invoices/html-formatter
 */

import type { EInvoice } from '@/seed/types/enterprise-billing';
import { formatCurrency } from '../fx-converter';
import { escapeHtml } from './escape-html';
import { getInvoiceCss } from './html-styles';

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
  <style>${getInvoiceCss(statusColor)}</style>
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
