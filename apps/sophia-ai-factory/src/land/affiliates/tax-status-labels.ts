/**
 * tax-status-labels.ts — Bilingual labels for the partner tax status surface.
 *
 * Every string the portal shows for tax documentation, kept in one place so
 * wording is reviewed once instead of drifting across the mapper and the React
 * component. All copy is Vietnamese + English together, because the (app) route
 * group sits outside the [locale] segment and has no per-locale namespace.
 *
 * Layer: land (affiliate portal vocabulary). Pure data — no logic.
 *
 * @module land/affiliates/tax-status-labels
 */

/** Status values stored on `affiliate_partners.tax_form_status` (migration 0478). */
export type TaxFormStatus =
  | 'not_submitted'
  | 'pending_verification'
  | 'verified'
  | 'rejected'
  | 'expired';

/** Form types stored on `affiliate_partners.tax_form_type` (migration 0478). */
export type StoredTaxFormType = 'w9' | 'w8ben' | 'local_declaration' | 'unknown';

/** Form types the Phase 1 resolver returns (uppercase variant). */
export type ResolverTaxFormType = 'W9' | 'W8BEN' | 'VN_SELF_DECLARATION' | 'UNKNOWN';

/** Anything the tab can be handed for a form type. */
export type TaxFormTypeInput = StoredTaxFormType | ResolverTaxFormType | string;

/** Whether a payout may be released right now. */
export type PayoutBlocking = 'released' | 'held';

/** A short bilingual string pair. */
export interface BilingualLabel {
  vi: string;
  en: string;
}

/** Human form names, keyed by the lowercase stored vocabulary. */
export const FORM_LABELS: Record<StoredTaxFormType, BilingualLabel> = {
  w9: { vi: 'Mẫu W-9 (người nộp thuế trong nước Hoa Kỳ)', en: 'Form W-9 (US domestic taxpayer)' },
  w8ben: { vi: 'Mẫu W-8BEN (chủ sở hữu thực tế nước ngoài)', en: 'Form W-8BEN (foreign beneficial owner)' },
  local_declaration: { vi: 'Tự kê khai theo quy định trong nước', en: 'Local self-declaration' },
  unknown: { vi: 'Chưa xác định được mẫu thuế', en: 'Tax form not determined yet' },
};

/** Bilingual status names. */
export const STATUS_LABELS: Record<TaxFormStatus, BilingualLabel> = {
  not_submitted: { vi: 'Chưa nộp', en: 'Not submitted' },
  pending_verification: { vi: 'Đang chờ xác minh', en: 'Pending verification' },
  verified: { vi: 'Đã xác minh', en: 'Verified' },
  rejected: { vi: 'Bị từ chối', en: 'Rejected' },
  expired: { vi: 'Đã hết hạn', en: 'Expired' },
};

/** What each status means for payout release. */
export const PAYOUT_BY_STATUS: Record<TaxFormStatus, PayoutBlocking> = {
  not_submitted: 'held',
  pending_verification: 'held',
  verified: 'released',
  rejected: 'held',
  expired: 'held',
};

/** Action shown when a form is required and nothing is on file yet. */
export const SUBMIT_FORM_ACTION: BilingualLabel = {
  vi: 'Hãy tải lên mẫu thuế tương ứng để mở khóa thanh toán.',
  en: 'Please upload the matching tax form to unlock payouts.',
};

/** Next action per status; `verified` maps to no action. */
export const NEXT_ACTION_BY_STATUS: Record<TaxFormStatus, BilingualLabel | null> = {
  not_submitted: SUBMIT_FORM_ACTION,
  pending_verification: {
    vi: 'Chúng tôi đang kiểm tra hồ sơ của bạn, thường mất 1-2 ngày làm việc.',
    en: 'We are reviewing your document. This usually takes 1-2 business days.',
  },
  verified: null,
  rejected: {
    vi: 'Mẫu trước chưa được chấp nhận. Vui lòng nộp lại đúng loại mẫu.',
    en: 'The previous form was not accepted. Please resubmit the correct form type.',
  },
  expired: {
    vi: 'Mẫu thuế đã hết hạn. Vui lòng nộp lại bản mới.',
    en: 'Your tax form has expired. Please submit a current one.',
  },
};

/** Action shown when residency is undeclared, so no form can be named. */
export const DECLARE_COUNTRY_ACTION: BilingualLabel = {
  vi: 'Vui lòng cập nhật quốc gia cư trú để chúng tôi xác định đúng mẫu thuế.',
  en: 'Please set your country of residence so we can determine the right form.',
};

/** Shown in the undeclared-country state instead of a named next action. */
export const UNDETERMINED_DESCRIPTION: BilingualLabel = {
  vi: 'Chúng tôi chưa biết bạn cư trú ở đâu nên chưa thể xác định mẫu thuế. Thanh toán tạm giữ cho đến khi bạn cập nhật.',
  en: 'We do not yet know where you are tax resident, so we cannot determine your form. Payouts are held until you update this.',
};

/** Badge tone per status. */
export const TONE_BY_STATUS: Record<TaxFormStatus, 'success' | 'warning' | 'error'> = {
  not_submitted: 'error',
  pending_verification: 'warning',
  verified: 'success',
  rejected: 'error',
  expired: 'error',
};
