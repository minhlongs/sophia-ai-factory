/**
 * Inline XBRL (iXBRL) Taxonomy Tag Generator for Dual-Listing Filing Periods
 *
 * Layer: tree (Business Logic)
 *
 * @module tree/listing/dual-listing/ixbrl-tag-generator
 */

import type {
  DualListingPeriod,
  IxbrlTaxonomy,
  IxbrlTagItem,
} from './types';

/**
 * Generates standard Inline XBRL (iXBRL) taxonomy entries for a filing period.
 */
export function buildIxbrlTagsForPeriod(filingPeriod: DualListingPeriod): IxbrlTaxonomy[] {
  const standard = filingPeriod.filingType.startsWith('SEC') ? 'US_GAAP_2026' : 'SFRS_I_2026';
  const contextRef = `FD_${filingPeriod.fiscalYear}_${filingPeriod.filingType}`;

  const items: IxbrlTagItem[] = [
    {
      tag: 'Revenues',
      valRaw: String(filingPeriod.consolidatedRevenueCents / 100),
      valNum: filingPeriod.consolidatedRevenueCents,
      desc: 'Total consolidated revenue from contracts with customers',
    },
    {
      tag: 'OperatingIncomeLoss',
      valRaw: String(filingPeriod.consolidatedEbitdaCents / 100),
      valNum: filingPeriod.consolidatedEbitdaCents,
      desc: 'Consolidated EBITDA from operations',
    },
    {
      tag: 'NetIncomeLoss',
      valRaw: String(filingPeriod.netIncomeCents / 100),
      valNum: filingPeriod.netIncomeCents,
      desc: 'Consolidated net income available to common stockholders',
    },
    {
      tag: 'FreeCashFlow',
      valRaw: String(filingPeriod.freeCashFlowCents / 100),
      valNum: filingPeriod.freeCashFlowCents,
      desc: 'Non-GAAP Free Cash Flow',
    },
  ];

  return items.map((item, idx) => ({
    id: `ixbrl_${filingPeriod.id}_${idx + 1}`,
    filingPeriodId: filingPeriod.id,
    standard,
    tagName: item.tag,
    contextRef,
    unitRef: 'iso4217:USD',
    decimals: '-3',
    valueRaw: item.valRaw,
    valueNumeric: item.valNum,
    isNegated: false,
    lineItemDescription: item.desc,
    createdAt: new Date().toISOString(),
  }));
}
