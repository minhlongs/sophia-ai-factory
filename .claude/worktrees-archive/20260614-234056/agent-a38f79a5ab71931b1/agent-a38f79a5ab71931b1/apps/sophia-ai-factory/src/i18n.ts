import { getRequestConfig } from 'next-intl/server';

import { logger } from '@/seed/utils/logger-utility';

// Can be imported from a shared config
const locales = ['en', 'vi'] as const;
const defaultLocale: (typeof locales)[number] = 'vi';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...flattenKeys(v as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

function diffMissingKeys(source: string[], target: string[]): string[] {
  const targetSet = new Set(target);
  return source.filter((k) => !targetSet.has(k));
}

function reportMissingKeys(missing: string[], locale: string): void {
  if (missing.length === 0) return;
  const sample = missing.slice(0, 5).join(', ');
  const suffix = missing.length > 5 ? ` (and ${missing.length - 5} more)` : '';
  const msg = `[i18n] Missing ${missing.length} key(s) in locale "${locale}": ${sample}${suffix}`;
  logger.warn(msg);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // Routes outside the [locale] segment (e.g. /setup-wizard) have no
  // requestLocale — fall back to the default rather than throwing notFound,
  // otherwise authenticated onboarding pages 404.
  const locale = requested && (locales as readonly string[]).includes(requested)
    ? requested
    : defaultLocale;

  const messages = (await import(`../messages/${locale}.json`)).default as Record<
    string,
    unknown
  >;

  if (locale !== defaultLocale) {
    try {
      const defaultMessages = (await import('../messages/vi.json')).default as Record<
        string,
        unknown
      >;
      const defaultKeys = flattenKeys(defaultMessages);
      const localeKeys = flattenKeys(messages);
      const missing = diffMissingKeys(defaultKeys, localeKeys);
      reportMissingKeys(missing, locale);
    } catch {
      // If default messages can't be loaded, skip diff — original fallback
      // behavior (vi keys serve as implicit fallback via next-intl) remains.
    }
  }

  return { messages, locale };
});
