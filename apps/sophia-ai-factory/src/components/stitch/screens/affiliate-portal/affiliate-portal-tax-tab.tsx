/**
 * Affiliate portal — Tax documentation tab.
 *
 * Shows the partner which tax form applies to them, whether it is on file, and
 * exactly what that state blocks (payout release). Fed by the Phase 1 resolver
 * vocabulary plus the stored `tax_form_status`.
 *
 * Privacy boundary: this component renders only a form *type*, a form *status*
 * and a residency country. It never receives, stores or displays a tax
 * identification number, passport number or street address. The document itself
 * stays with the partner.
 *
 * Bilingual: labels come pre-localised from `buildTaxStatusView`, so both
 * languages render together rather than switching, because the (app) route group
 * sits outside the [locale] segment and has no per-locale message namespace.
 *
 * @module components/stitch/screens/affiliate-portal/affiliate-portal-tax-tab
 */

'use client';

import React from 'react';
import { Badge, Card, CardContent, CardHeader } from '@/components/stitch';
import {
  buildTaxStatusView,
  type TaxFormStatus,
} from '@/land/affiliates/tax-status-presentation';

/** The partner's stored tax fields this tab needs. All are non-sensitive. */
export interface AffiliateTaxTabData {
  /** Form type as stored, or as the Phase 1 resolver returned it. */
  formType: string;
  /** Verification status of the form on file. */
  status: TaxFormStatus;
  /** Declared residency country code, or `'unknown'`. */
  country: string;
}

/** Whether payouts are released or held, phrased for display. */
const PAYOUT_COPY = {
  released: {
    vi: 'Thanh toán đang được giải phóng bình thường.',
    en: 'Payouts are being released normally.',
  },
  held: {
    vi: 'Thanh toán đang tạm giữ cho đến khi hồ sơ thuế hoàn tất.',
    en: 'Payouts are held until your tax documentation is complete.',
  },
} as const;

/** Badge colour for the payout state. */
const PAYOUT_TONE = {
  released: 'success',
  held: 'warning',
} as const;

export function AffiliateTaxTab({ data }: { data: AffiliateTaxTabData }) {
  const t = buildTaxStatusView(data);
  const payout = PAYOUT_COPY[t.payoutBlocking];

  return (
    <Card padding="lg">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-sm">
          <h3 className="font-headline-sm text-headline-sm text-on-surface">
            Tax Documentation / Hồ sơ thuế
          </h3>
          <Badge variant="soft" color={t.tone}>
            {t.statusLabel.en} · {t.statusLabel.vi}
          </Badge>
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          We collect tax paperwork so your commission can be paid lawfully. Chúng tôi
          thu thập hồ sơ thuế để thanh toán hoa hồng của bạn đúng quy định.
        </p>
      </CardHeader>

      <CardContent>
        <div className="space-y-md">
          {/* Which form applies to this partner. */}
          <div className="bg-surface rounded-xl p-md">
            <p className="font-label-sm text-label-sm text-on-surface-variant mb-xs">
              Required form / Mẫu cần nộp
            </p>
            <p className="font-label-lg text-on-surface">{t.formLabel.en}</p>
            <p className="text-sm text-on-surface-variant">{t.formLabel.vi}</p>
          </div>

          {/* What the current state means, in both languages. */}
          <p className="font-body-md text-body-md text-on-surface">{t.description.en}</p>
          <p className="font-body-md text-body-md text-on-surface-variant">{t.description.vi}</p>

          {/* What it blocks — always stated explicitly so it is never a surprise. */}
          <div className="flex flex-wrap items-center gap-sm rounded-xl bg-surface p-md">
            <Badge variant="soft" color={PAYOUT_TONE[t.payoutBlocking]}>
              {t.payoutBlocking === 'released' ? 'Payouts released' : 'Payouts held'}
            </Badge>
            <span className="text-sm text-on-surface-variant">
              {payout.en} {payout.vi}
            </span>
          </div>

          {/* The partner's next step, when one exists. */}
          {t.nextAction ? (
            <div className="rounded-xl border border-outline-variant p-md">
              <p className="font-label-md text-on-surface">{t.nextAction.en}</p>
              <p className="text-sm text-on-surface-variant">{t.nextAction.vi}</p>
            </div>
          ) : null}

          {/* Explicit scope statement: no identifier is ever stored or shown. */}
          <p className="font-label-sm text-label-sm text-on-surface-variant">
            We never store your tax ID number, passport or address. Chúng tôi không
            lưu số định danh thuế, hộ chiếu hay địa chỉ của bạn.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default AffiliateTaxTab;
