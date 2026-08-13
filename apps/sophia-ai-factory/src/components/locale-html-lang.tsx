'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

/**
 * Sets <html lang="..."> to the current locale after hydration.
 * Root layout renders `lang="vi"` as a safe SSR default; this
 * component corrects it client-side for non-Vietnamese locales.
 */
export function LocaleHtmlLang() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
