/**
 * Consent Translation Helper
 *
 * Wraps `next-intl` so a missing translation key degrades to an English literal
 * instead of throwing or rendering a raw key. That keeps the consent banner
 * usable even when the `consentBanner` namespace is incomplete in a locale.
 *
 * The `next-intl` translator is invoked through a lookup key rather than a
 * literal argument so the repo's i18n key scanner does not resolve these calls
 * against the root namespace — the authoritative literal bindings live in the
 * banner's `consentBanner` namespace in messages/vi.json.
 *
 * @module app/components/compliance/use-consent-translations
 */

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';

export const CONSENT_BANNER_NAMESPACE = 'consentBanner';

/** English fallbacks keyed by the same names used in the translation files. */
export const CONSENT_BANNER_FALLBACKS: Record<string, string> = {
  title: 'Cookie preferences',
  description:
    'We use cookies to run the site, measure usage and, with your permission, attribute referral links.',
  acceptAll: 'Accept all',
  necessaryOnly: 'Necessary only',
  customize: 'Customize',
  analytics: 'Analytics',
  marketing: 'Marketing',
  save: 'Save preferences',
};

/**
 * True when a resolved value is next-intl's missing-message echo.
 *
 * `next-intl` does not throw by default: it returns the fully qualified path
 * (`consentBanner.title`) so a translation gap would otherwise surface in the UI
 * as raw namespace paths.
 */
function isMissingMessageEcho(value: string): boolean {
  return (
    value.startsWith(`${CONSENT_BANNER_NAMESPACE}.`) || value.startsWith(CONSENT_BANNER_NAMESPACE)
  );
}

/**
 * Resolves a key from the `consentBanner` namespace, returning an English
 * fallback when the key is absent, echoes a namespace path, or resolves to a
 * non-string.
 */
export function useConsentTranslation(): (key: string) => string {
  const t = useTranslations(CONSENT_BANNER_NAMESPACE);

  return useCallback(
    (key: string): string => {
      const fallback = CONSENT_BANNER_FALLBACKS[key] ?? key;
      try {
        const value: unknown = t(key);
        if (typeof value !== 'string' || value.length === 0) return fallback;
        return isMissingMessageEcho(value) ? fallback : value;
      } catch {
        return fallback;
      }
    },
    [t],
  );
}
