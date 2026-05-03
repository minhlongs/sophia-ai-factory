import { getRequestConfig } from 'next-intl/server';

// Can be imported from a shared config
const locales = ['en', 'vi'] as const;
const defaultLocale: (typeof locales)[number] = 'vi';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // Routes outside the [locale] segment (e.g. /setup-wizard) have no
  // requestLocale — fall back to the default rather than throwing notFound,
  // otherwise authenticated onboarding pages 404.
  const locale = requested && (locales as readonly string[]).includes(requested)
    ? requested
    : defaultLocale;

  return {
    messages: (await import(`../messages/${locale}.json`)).default,
    locale
  };
});
