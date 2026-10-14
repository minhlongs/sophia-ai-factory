/**
 * Enterprise 12 Locales and RTL Specifications
 *
 * Layer: seed/types
 */

/**
 * The 12 canonical enterprise locales supported by Sophia AI Factory.
 * Covers APAC (EN, VI, JA, KO, TH, ID), Greater China (ZH), Europe (ES, FR, DE),
 * South Asia (HI), and Middle East & North Africa (AR).
 */
export const ENTERPRISE_12_LOCALES = [
  'en',
  'vi',
  'ja',
  'ko',
  'zh',
  'es',
  'fr',
  'de',
  'th',
  'id',
  'hi',
  'ar',
] as const;

export type EnterpriseLocale = (typeof ENTERPRISE_12_LOCALES)[number];

/**
 * Locales requiring Right-to-Left (RTL) text flow and bidirectional layout isolation.
 */
export const RTL_LOCALES: readonly EnterpriseLocale[] = ['ar'] as const;

/**
 * Fast O(1) predicate to determine if a locale string requires Right-To-Left layout.
 */
export function isRtlLocale(locale: string | null | undefined): boolean {
  if (!locale) return false;
  const base = locale.toLowerCase().trim().split(/[-_]/)[0];
  return (RTL_LOCALES as readonly string[]).includes(base as EnterpriseLocale);
}

/**
 * Check if a given string is a valid supported Enterprise 12 locale.
 */
export function isEnterpriseLocale(locale: string | null | undefined): locale is EnterpriseLocale {
  if (!locale) return false;
  const normalized = locale.toLowerCase().trim().split(/[-_]/)[0];
  return (ENTERPRISE_12_LOCALES as readonly string[]).includes(normalized);
}
