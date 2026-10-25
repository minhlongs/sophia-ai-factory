/**
 * jurisdiction-options.ts — Declarable audience regions for the settings picker.
 *
 * The compliance gate distinguishes only five jurisdictions for regulated
 * verticals (crypto, trading): VN (blocked outright), and US / EU / SG / JP
 * (permitted once the mandated disclosure is attached). Any code outside that
 * set falls back to US, which is why the settings UI presents a closed list
 * instead of a free-text country field — a tenant typing an unsupported code
 * would believe it declared something the gate never reads.
 *
 * The "not declared" entry carries `code: null`. That is the state the gate
 * treats as unknown, and therefore blocked for regulated content.
 *
 * `blocked` means "regulated content cannot be published here". It is true for
 * VN (legal prohibition) and for the undeclared entry (unknown audience), so
 * the picker can warn from data instead of hard-coding a list of bad regions.
 *
 * Layer: seed (foundational, edge-runtime safe — pure data, no runtime APIs).
 *
 * @module seed/compliance/jurisdiction-options
 */

/** Jurisdiction codes the compliance gate actually applies distinct rules to. */
export type DeclarableJurisdictionCode = 'US' | 'EU' | 'VN' | 'SG' | 'JP';

export interface JurisdictionOption {
  /** Value persisted to the tenant settings. `null` means "not declared". */
  readonly code: DeclarableJurisdictionCode | null;
  readonly labelVi: string;
  readonly labelEn: string;
  /** Plain-language consequence of publishing to this region. */
  readonly noteVi: string;
  readonly noteEn: string;
  /** Regulated verticals (crypto, trading) cannot be published here. */
  readonly blocked: boolean;
}

/** `<select>` value standing for the "not declared" choice. */
export const UNDECLARED_SELECT_VALUE = '';

export const JURISDICTION_OPTIONS: readonly JurisdictionOption[] = [
  {
    code: 'US',
    labelVi: 'Hoa Kỳ (US)',
    labelEn: 'United States (US)',
    noteVi:
      'Được phép phát nội dung về tiền điện tử và giao dịch, nhưng mỗi bài bắt buộc phải kèm cảnh báo rủi ro.',
    noteEn:
      'Crypto and trading content is allowed, but every post must carry the required risk warning.',
    blocked: false,
  },
  {
    code: 'EU',
    labelVi: 'Liên minh châu Âu (EU)',
    labelEn: 'European Union (EU)',
    noteVi:
      'Được phép nếu mỗi bài có ghi rõ nội dung mang tính quảng bá và cảnh báo vốn có thể bị mất.',
    noteEn:
      'Allowed when every post states it is promotional and warns that capital is at risk.',
    blocked: false,
  },
  {
    code: 'SG',
    labelVi: 'Singapore (SG)',
    labelEn: 'Singapore (SG)',
    noteVi: 'Được phép nếu có cảnh báo rủi ro cao bắt buộc tại Singapore.',
    noteEn: 'Allowed with the high-risk warning Singapore requires.',
    blocked: false,
  },
  {
    code: 'JP',
    labelVi: 'Nhật Bản (JP)',
    labelEn: 'Japan (JP)',
    noteVi: 'Được phép, nhưng chỉ được quảng bá nền tảng đã đăng ký với cơ quan quản lý Nhật Bản.',
    noteEn: 'Allowed, but only platforms registered with the Japanese regulator may be promoted.',
    blocked: false,
  },
  {
    code: 'VN',
    labelVi: 'Việt Nam (VN)',
    labelEn: 'Vietnam (VN)',
    noteVi:
      'BỊ CHẶN: quảng bá tiền điện tử đến khán giả Việt Nam bị cấm theo pháp luật, nên hệ thống sẽ dừng nội dung này.',
    noteEn:
      'BLOCKED: promoting crypto assets to a Vietnam audience is prohibited by law, so the system stops this content.',
    blocked: true,
  },
  // `note` is absent by design: the undeclared state has no region to describe,
  // and the picker shows `undeclaredWarning` for it instead, so the consequence
  // is stated once rather than in two places that can drift apart.
  {
    code: null,
    labelVi: 'Chưa khai báo',
    labelEn: 'Not declared yet',
    noteVi: '',
    noteEn: '',
    blocked: true,
  },
];

/**
 * Look up an option by its persisted code. Returns `undefined` for a code the
 * gate does not apply distinct rules to, so callers can tell a supported
 * declaration from a stored-but-unrecognised one.
 */
export function findJurisdictionOption(code: string | null): JurisdictionOption | undefined {
  return JURISDICTION_OPTIONS.find((option) => option.code === code);
}

/* -------------------------------------------------------------------------- */
/* Response parsers                                                           */
/* -------------------------------------------------------------------------- */

export type PickerLocale = 'vi' | 'en';

/**
 * Region the gate really applies when the stored code is not one it
 * distinguishes. `getDisclaimerForJurisdiction` falls back to US, so an
 * unrecognised declaration is governed by US rules rather than blocked.
 */
const GATE_FALLBACK_CODE = 'US';

/**
 * Read the ISO code out of the geo namespace value returned by the API.
 *
 * A stored code the gate does not distinguish (e.g. 'BR') is normalised to 'US'
 * because that is the region the gate actually applies for it — claiming the
 * content is blocked would be false, since the US disclosure path is used. The
 * picker therefore shows the region whose rules are really in force; saving then
 * makes that explicit. Only an absent or empty declaration stays undeclared,
 * which is the one state that blocks regulated content.
 */
export function readDeclaredCode(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const declared = (value as { targetJurisdiction?: unknown }).targetJurisdiction;
  if (typeof declared !== 'string') return null;
  const code = declared.trim().toUpperCase();
  if (code.length === 0) return null;
  return findJurisdictionOption(code) ? code : GATE_FALLBACK_CODE;
}

/**
 * Read the display label for a code. An absent or unrecognised code falls back
 * to the "not declared" entry's own label, so the label stays single-sourced
 * with the option list the picker renders from.
 */
export function jurisdictionLabel(code: string | null, locale: PickerLocale): string {
  const option = findJurisdictionOption(code);
  if (option) return locale === 'vi' ? option.labelVi : option.labelEn;
  const undeclared = findJurisdictionOption(null);
  return undeclared ? (locale === 'vi' ? undeclared.labelVi : undeclared.labelEn) : '';
}

/** Pull a human-readable reason out of an error body, or null when absent. */
export function errorMessageFromBody(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { message, error } = parsed as { message?: unknown; error?: unknown };
    if (typeof message === 'string' && message.trim().length > 0) return message.trim();
    if (typeof error === 'string' && error.trim().length > 0) return error.trim();
    return null;
  } catch {
    return null;
  }
}
