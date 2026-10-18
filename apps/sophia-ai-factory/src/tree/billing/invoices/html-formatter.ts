/**
 * Bilingual Print-Optimized HTML Invoice Document Generator
 *
 * @module tree/billing/invoices/html-formatter
 */

import type { EInvoice } from '@/seed/types/enterprise-billing';
import { formatCurrency } from '../fx-converter';
import { escapeHtml } from './escape-html';
import { getInvoiceCss } from './html-styles';
import { EN_LABELS, resolveTaxFormNote, VI_LABELS } from './html-labels';
import { renderEntityGridHtml, renderLineItemsAndTotalsHtml } from './html-body-sections';

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
  const taxNoteBody = resolveTaxFormNote(invoice.taxFormType, isVi);

  const entityGridHtml = renderEntityGridHtml(invoice, L);
  const itemsAndTotalsHtml = renderLineItemsAndTotalsHtml(
    invoice,
    L,
    subtotalFormatted,
    vatRowLabel,
    vatFormatted,
    totalFormatted,
  );

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

    ${entityGridHtml}

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

    ${itemsAndTotalsHtml}

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
