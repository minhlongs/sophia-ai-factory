/**
 * Accept-Language RFC 5646 / RFC 9110 parser and country map for APAC Geo-Router.
 * @module tree/localization/accept-language-parser
 */

import type { ApacLocale } from '@/seed/types/dubbing';

/**
 * Mapping of ISO 3166-1 alpha-2 country codes to primary APAC locales.
 */
export const COUNTRY_TO_LOCALE_MAP: Readonly<Record<string, ApacLocale>> = {
  VN: 'vi',
  JP: 'ja',
  KR: 'ko',
  TH: 'th',
  SG: 'en',
  AU: 'en',
  NZ: 'en',
  PH: 'en',
  MY: 'en',
  IN: 'en',
  US: 'en',
  GB: 'en',
  CA: 'en',
};

/**
 * Parsed Accept-Language entry with quality weight.
 */
export interface ParsedLanguage {
  locale: string;
  primaryCode: string;
  q: number;
}

function parseQualityWeight(params: string[]): number {
  for (const param of params) {
    const [key, val] = param.trim().split('=');
    if (key?.trim() === 'q') {
      const trimmedVal = val?.trim();
      const parsedQ = trimmedVal ? parseFloat(trimmedVal) : NaN;
      return Number.isFinite(parsedQ) && parsedQ >= 0 && parsedQ <= 1 ? parsedQ : 0.0;
    }
  }
  return 1.0;
}

/**
 * Parse an HTTP `Accept-Language` header according to RFC 5646 and RFC 9110.
 * Example: "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7"
 */
export function parseAcceptLanguage(header: string | null | undefined): ParsedLanguage[] {
  if (!header || typeof header !== 'string') return [];

  const rawEntries = header.split(',');
  const parsed: ParsedLanguage[] = [];

  for (const raw of rawEntries) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    const [langTag, ...params] = trimmed.split(';');
    const cleanTag = langTag.trim().toLowerCase();
    if (!cleanTag || cleanTag === '*') continue;

    const q = parseQualityWeight(params);
    const primaryCode = cleanTag.split('-')[0];
    parsed.push({
      locale: cleanTag,
      primaryCode,
      q,
    });
  }

  return parsed.sort((a, b) => b.q - a.q);
}
