/**
 * Round 39 — Auto-Localized FTC / MiCA / VN Decree 52 Disclosure Injector.
 *
 * Idempotently appends jurisdiction-compliant affiliate & crypto risk
 * disclosures while respecting platform caption character limits.
 *
 * @module seed/compliance/ftc-disclosure-injector
 */

import type { ComplianceJurisdiction } from './policy-preflight-engine';

export interface DisclosureInjectionInput {
  readonly caption: string;
  readonly jurisdiction: ComplianceJurisdiction;
  readonly vertical: 'crypto' | 'saas';
  readonly maxChars?: number;
}

export interface DisclosureInjectionResult {
  readonly caption: string;
  readonly injected: boolean;
  readonly disclosureUsed: string;
  readonly truncated: boolean;
}

const ALREADY_DISCLOSED_REGEX =
  /(?<![\p{L}\p{N}_])(?:#ad|#affiliate|affiliate\s+disclosure|paid\s+partnership|liên\s+kết\s+tiếp\s+thị|hoa\s+hồng\s+tiếp\s+thị)(?![\p{L}\p{N}_])/iu;

function resolveDisclosure(jurisdiction: ComplianceJurisdiction, vertical: 'crypto' | 'saas'): string {
  if (jurisdiction === 'VN') {
    return vertical === 'crypto'
      ? '#ad Liên kết tiếp thị. Không phải lời khuyên đầu tư tài chính.'
      : '#ad Liên kết tiếp thị — Sophia có thể nhận hoa hồng không tăng phí của bạn.';
  }
  if (jurisdiction === 'EU' || jurisdiction === 'UK') {
    return vertical === 'crypto'
      ? '#ad #affiliate Cryptoassets are unregulated & high risk. Not financial advice.'
      : '#ad #affiliate Paid partnership — we may earn a commission at no extra cost.';
  }
  return vertical === 'crypto'
    ? '#ad #affiliate Affiliate link. Not financial advice; crypto carries risk.'
    : '#ad #affiliate Affiliate link — we may earn a commission at no extra cost.';
}

export function injectLocalizedDisclosure(
  input: DisclosureInjectionInput,
): DisclosureInjectionResult {
  const clean = input.caption.trim();
  const maxChars =
    typeof input.maxChars === 'number' && Number.isFinite(input.maxChars) && input.maxChars >= 40
      ? Math.floor(input.maxChars)
      : 2200;
  const disclosure = resolveDisclosure(input.jurisdiction, input.vertical);

  if (ALREADY_DISCLOSED_REGEX.test(clean)) {
    const codePoints = Array.from(clean);
    const truncated = codePoints.length > maxChars;
    return {
      caption: truncated ? `${codePoints.slice(0, maxChars - 1).join('').trimEnd()}…` : clean,
      injected: false,
      disclosureUsed: disclosure,
      truncated,
    };
  }

  const separator = clean.length > 0 ? '\n\n' : '';
  const combined = `${clean}${separator}${disclosure}`;
  const combinedPoints = Array.from(combined);

  if (combinedPoints.length <= maxChars) {
    return {
      caption: combined,
      injected: true,
      disclosureUsed: disclosure,
      truncated: false,
    };
  }

  const disclosureLen = Array.from(disclosure).length;
  const allowedBodyLen = Math.max(0, maxChars - disclosureLen - separator.length - 1);
  const trimmedBody =
    allowedBodyLen > 0
      ? `${Array.from(clean).slice(0, allowedBodyLen).join('').trimEnd()}…`
      : '';
  const finalCaption = trimmedBody ? `${trimmedBody}${separator}${disclosure}` : disclosure;

  return {
    caption: finalCaption,
    injected: true,
    disclosureUsed: disclosure,
    truncated: true,
  };
}
