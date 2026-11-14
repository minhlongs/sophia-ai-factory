import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { SUPPORTED_LOCALES } from '@/middleware/middleware-shared-config';

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale?: string }>;
}) {
  const { locale: routeLocale } = await params;
  const headerList = await headers();
  const forwardedLocale = headerList.get('x-next-intl-locale');

  const locale = [routeLocale, forwardedLocale].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' &&
      (SUPPORTED_LOCALES as readonly string[]).includes(candidate),
  ) ?? 'vi';

  const messages = await getMessages({ locale });

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
