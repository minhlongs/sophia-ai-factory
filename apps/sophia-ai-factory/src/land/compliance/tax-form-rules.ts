/**
 * Tax Form Requirement Resolver (pure module)
 *
 * Determines which tax documentation an affiliate partner must supply before a
 * payout can be released. Pure by design: no I/O, no database reads, no logging
 * of partner-supplied tax identifiers, and safe to execute in the Edge runtime.
 *
 * Boundary rule: this module only answers "which form is required and why".
 * Persisting the answer (and the tax identifier itself) is a caller's job and
 * is owned by the payout layer.
 */

import { z } from 'zod';

/** Form types an IRS-backed payout flow can require from a partner. */
export type TaxFormType = 'W9' | 'W8BEN' | 'VN_SELF_DECLARATION' | 'UNKNOWN';

/** Countries that receive an explicit, non-default mapping. */
export type TaxCountry = 'US' | 'VN';

export const taxFormInputSchema = z.object({
  /** ISO 3166-1 alpha-2 country code. Case and surrounding whitespace are tolerated. */
  country: z.string(),
});

/** Caller-supplied argument: `country` may be absent, empty, or the wrong type. */
export type TaxFormInput = Partial<z.input<typeof taxFormInputSchema>>;

/** Result shape shared by every mapping branch. */
interface TaxFormRequirementBase {
  /** Form the partner must supply. `UNKNOWN` is never treated as `W9`. */
  formType: TaxFormType;
  /** ISO 3166-1 alpha-2 code the decision was made on, or `''` when unusable. */
  country: string;
  /** Bilingual reason shown to the partner so the request is never opaque. */
  reason: { vi: string; en: string };
  /** Whether a raw tax identifier may be collected alongside the form. */
  requiresTaxIdentifier: boolean;
}

/** Partner is inside the US: a domestic taxpayer form applies. */
export interface UsTaxFormRequirement extends TaxFormRequirementBase {
  formType: 'W9';
}

/** Partner is outside the US but not Vietnam: a foreign beneficial-owner form applies. */
export interface ForeignTaxFormRequirement extends TaxFormRequirementBase {
  formType: 'W8BEN';
}

/** Partner is in Vietnam: a local self-declaration applies instead of IRS forms. */
export interface VietnamTaxFormRequirement extends TaxFormRequirementBase {
  formType: 'VN_SELF_DECLARATION';
  country: 'VN';
}

/** Country was missing or malformed: callers must stop and ask again. */
export interface UnknownTaxFormRequirement extends TaxFormRequirementBase {
  formType: 'UNKNOWN';
  /** `true` only when a syntactically valid, non-US, non-VN code was supplied. */
  countryProvided: boolean;
}

export type TaxFormRequirement =
  | UsTaxFormRequirement
  | ForeignTaxFormRequirement
  | VietnamTaxFormRequirement
  | UnknownTaxFormRequirement;

const US_REASON = {
  vi: 'Đối tác tại Hoa Kỳ nên dùng mẫu W-9 để xác nhận là người nộp thuế trong nước.',
  en: 'Partners based in the United States complete Form W-9 to confirm domestic taxpayer status.',
} as const;

const FOREIGN_REASON = {
  vi: 'Đối tác ngoài Hoa Kỳ nên dùng mẫu W-8BEN để xác nhận quyền sở hữu thực tế ở nước ngoài.',
  en: 'Partners outside the United States complete Form W-8BEN to confirm foreign beneficial ownership.',
} as const;

const VN_REASON = {
  vi: 'Đối tác tại Việt Nam tự kê khai thu nhập theo quy định trong nước, không dùng mẫu W-9/W-8BEN của IRS.',
  en: 'Partners in Vietnam self-declare income under local rules; IRS forms W-9 and W-8BEN do not apply.',
} as const;

const MISSING_REASON = {
  vi: 'Chưa rõ quốc gia của đối tác nên chưa thể xác định mẫu thuế. Cần hỏi lại trước khi thanh toán.',
  en: 'Partner country is unclear, so no tax form can be determined yet. Ask again before paying out.',
} as const;

const UNRECOGNISED_REASON = {
  vi: 'Mã quốc gia chưa được hỗ trợ nên chưa thể xác định mẫu thuế. Cần xác nhận lại trước khi thanh toán.',
  en: 'Country code is not supported yet, so no tax form can be determined. Confirm before paying out.',
} as const;

/** Normalise a raw country value to a bare uppercase ISO alpha-2 code. */
function normaliseCountry(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Resolve which tax form a partner must supply for a given country.
 *
 * Pure: no I/O, no side effects, never logs or retains a tax identifier.
 * Returns a discriminated result so callers must handle `UNKNOWN` explicitly
 * instead of silently falling back to `W9`.
 */
export function resolveTaxFormRequirement(input: TaxFormInput): TaxFormRequirement {
  const parsed = taxFormInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      formType: 'UNKNOWN',
      country: '',
      reason: MISSING_REASON,
      requiresTaxIdentifier: false,
      countryProvided: false,
    };
  }

  const country = normaliseCountry(parsed.data.country);

  if (country.length === 0) {
    return {
      formType: 'UNKNOWN',
      country: '',
      reason: MISSING_REASON,
      requiresTaxIdentifier: false,
      countryProvided: false,
    };
  }

  if (country === 'US') {
    return {
      formType: 'W9',
      country,
      reason: US_REASON,
      requiresTaxIdentifier: true,
    };
  }

  if (country === 'VN') {
    return {
      formType: 'VN_SELF_DECLARATION',
      country,
      reason: VN_REASON,
      requiresTaxIdentifier: true,
    };
  }

  if (/^[A-Z]{2}$/.test(country)) {
    return {
      formType: 'W8BEN',
      country,
      reason: FOREIGN_REASON,
      requiresTaxIdentifier: true,
    };
  }

  return {
    formType: 'UNKNOWN',
    country,
    reason: UNRECOGNISED_REASON,
    requiresTaxIdentifier: false,
    countryProvided: true,
  };
}

/** `true` when the requirement is settled and a payout may proceed. */
export function isTaxFormResolved(requirement: TaxFormRequirement): boolean {
  return requirement.formType !== 'UNKNOWN';
}
