/**
 * HTML Invoice Entity Grid & Line Item Table Builders
 *
 * @module tree/billing/invoices/html-body-sections
 */

import type { EInvoice } from '@/seed/types/enterprise-billing';
import { escapeHtml } from './escape-html';
import type { EN_LABELS, VI_LABELS } from './html-labels';

type InvoiceLabels = typeof EN_LABELS | typeof VI_LABELS;

export function renderEntityGridHtml(
  invoice: EInvoice,
  L: InvoiceLabels,
): string {
  const customerTaxIdText = escapeHtml(invoice.taxId) || L.naText;
  const subaccountHtml = invoice.subaccountId
    ? `<div class="entity-detail">${L.subaccountLabel}: ${escapeHtml(invoice.subaccountId)}</div>`
    : '';

  return `<div class="entity-grid">
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
    </div>`;
}

export function renderLineItemsAndTotalsHtml(
  invoice: EInvoice,
  L: InvoiceLabels,
  subtotalFormatted: string,
  vatRowLabel: string,
  vatFormatted: string,
  totalFormatted: string,
): string {
  return `<table class="line-items">
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
    </div>`;
}
