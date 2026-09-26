'use client';

import { useLocale } from 'next-intl';
import { useEffect } from 'react';

import { isRtlLocale } from '@/seed/types/edge-mesh';

/**
 * Sets <html lang="..."> and <html dir="..."> to the current locale after hydration.
 * Root layout renders `lang="vi"` and `dir="ltr"` as a safe SSR default; this
 * component corrects them client-side for non-Vietnamese or RTL (Arabic) locales.
 */
export function LocaleHtmlLang() {
  const locale = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtlLocale(locale) ? 'rtl' : 'ltr';
  }, [locale]);

  return null;
}
