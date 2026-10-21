/**
 * tax-status-presentation.ts — Map stored tax fields to a portal view model.
 *
 * Pure mapping layer between what is stored on `affiliate_partners`
 * (`tax_form_type`, `tax_form_status`, `tax_country`) and the vocabulary the
 * partner portal shows. Kept separate from the React component so the mapping
 * can be unit tested without rendering.
 *
 * Privacy boundary: this module maps *statuses* to *labels*. It never receives,
 * stores or displays a tax identification number, passport number or street
 * address — the partner's document stays with the partner.
 *
 * Layer: land (affiliate portal surface).
 *
 * @module land/affiliates/tax-status-presentation
 */

import {
  DECLARE_COUNTRY_ACTION,
  FORM_LABELS,
  NEXT_ACTION_BY_STATUS,
  PAYOUT_BY_STATUS,
  STATUS_LABELS,
  SUBMIT_FORM_ACTION,
  TONE_BY_STATUS,
  UNDETERMINED_DESCRIPTION,
  type BilingualLabel,
  type PayoutBlocking,
  type StoredTaxFormType,
  type TaxFormStatus,
  type TaxFormTypeInput,
} from './tax-status-labels';

export type { BilingualLabel, PayoutBlocking, StoredTaxFormType, TaxFormStatus, TaxFormTypeInput };
export { FORM_LABELS, STATUS_LABELS };

/** Everything the portal needs to render the tax tab. */
export interface TaxStatusView {
  /** The stored form type, normalised to the lowercase vocabulary. */
  formType: StoredTaxFormType;
  /** The stored verification status. */
  status: TaxFormStatus;
  /** Declared residency country, or `'unknown'`. */
  country: string;
  /** Short bilingual label for the form the partner must supply. */
  formLabel: BilingualLabel;
  /** Short bilingual label for the current verification status. */
  statusLabel: BilingualLabel;
  /** Bilingual explanation of the state and what happens next. */
  description: BilingualLabel;
  /** Whether payouts are released or held while this state stands. */
  payoutBlocking: PayoutBlocking;
  /** Badge colour the UI should use for the status. */
  tone: 'success' | 'warning' | 'error' | 'neutral';
  /** Next action the partner must take, or null when nothing is required. */
  nextAction: BilingualLabel | null;
}

/**
 * Normalise either form vocabulary to the lowercase stored one.
 *
 * The Phase 1 resolver speaks uppercase (`W9`/`W8BEN`/`VN_SELF_DECLARATION`)
 * while the database column stores lowercase (`w9`/`w8ben`/`local_declaration`).
 * Mapping here means a caller may pass whichever it already holds.
 */
export function normaliseFormType(input: TaxFormTypeInput): StoredTaxFormType {
  switch (input) {
    case 'w9':
    case 'W9':
      return 'w9';
    case 'w8ben':
    case 'W8BEN':
      return 'w8ben';
    case 'local_declaration':
    case 'VN_SELF_DECLARATION':
      return 'local_declaration';
    default:
      return 'unknown';
  }
}

/**
 * Accept only a well-formed ISO 3166-1 alpha-2 code as a country.
 *
 * Anything else — empty, longer strings, identifier-shaped values — becomes
 * `'unknown'`. This is deliberate: the mapper's job is to render a residency
 * code, and reflecting an arbitrary caller-supplied string back into the UI
 * would risk surfacing whatever the caller put in that slot. A value we cannot
 * prove is a country is treated as "not declared".
 */
function normaliseCountry(raw: unknown): string {
  if (typeof raw !== 'string') return 'unknown';
  const trimmed = raw.trim().toUpperCase();
  if (trimmed === 'UNKNOWN') return 'unknown';
  return /^[A-Z]{2}$/.test(trimmed) ? trimmed : 'unknown';
}

function describeVietnamese(formType: StoredTaxFormType, status: TaxFormStatus): string {
  const form = FORM_LABELS[formType].vi;
  switch (status) {
    case 'verified':
      return `Bạn đã nộp ${form} và hồ sơ hợp lệ, nên thanh toán được giải phóng bình thường.`;
    case 'pending_verification':
      return `Bạn đã nộp ${form} và chúng tôi đang xác minh. Thanh toán tạm giữ đến khi hoàn tất.`;
    case 'rejected':
      return `${form} bạn nộp chưa được chấp nhận nên thanh toán đang bị giữ.`;
    case 'expired':
      return `${form} của bạn đã hết hạn nên thanh toán đang bị giữ.`;
    default:
      return `Chúng tôi cần ${form} trước khi thanh toán có thể được giải phóng.`;
  }
}

function describeEnglish(formType: StoredTaxFormType, status: TaxFormStatus): string {
  const form = FORM_LABELS[formType].en;
  switch (status) {
    case 'verified':
      return `Your ${form} is on file and accepted, so payouts are released normally.`;
    case 'pending_verification':
      return `Your ${form} is under review. Payouts are held until verification completes.`;
    case 'rejected':
      return `Your submitted ${form} was not accepted, so payouts are on hold.`;
    case 'expired':
      return `Your ${form} has expired, so payouts are on hold.`;
    default:
      return `We need your ${form} before any payout can be released.`;
  }
}

/**
 * Build the full view model from stored partner tax fields.
 *
 * Returns an object with every field resolved, so the component never has to
 * branch on raw strings. An undeclared country short-circuits to the honest
 * "we cannot name a form yet" state rather than guessing.
 */
export function buildTaxStatusView(input: {
  formType: TaxFormTypeInput;
  status: TaxFormStatus;
  country: string;
}): TaxStatusView {
  const formType = normaliseFormType(input.formType);
  const country = normaliseCountry(input.country);

  if (formType === 'unknown' || country === 'unknown') {
    return {
      formType,
      status: input.status,
      country,
      formLabel: FORM_LABELS.unknown,
      statusLabel: STATUS_LABELS[input.status],
      description: UNDETERMINED_DESCRIPTION,
      payoutBlocking: 'held',
      tone: 'warning',
      // A partner with no declared country and nothing on file is asked to
      // declare residence first; anything on file is asked to upload.
      nextAction: input.status === 'not_submitted'
        ? DECLARE_COUNTRY_ACTION
        : SUBMIT_FORM_ACTION,
    };
  }

  return {
    formType,
    status: input.status,
    country,
    formLabel: FORM_LABELS[formType],
    statusLabel: STATUS_LABELS[input.status],
    description: {
      vi: describeVietnamese(formType, input.status),
      en: describeEnglish(formType, input.status),
    },
    payoutBlocking: PAYOUT_BY_STATUS[input.status],
    tone: TONE_BY_STATUS[input.status],
    nextAction: NEXT_ACTION_BY_STATUS[input.status],
  };
}
