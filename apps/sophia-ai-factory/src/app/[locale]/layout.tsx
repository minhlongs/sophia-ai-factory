import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { LocaleHtmlLang } from '@/components/locale-html-lang';
import { PostHogProvider } from '@/forest/components/posthog-provider';
import { Ga4Script } from '@/land/analytics/ga4-script';

const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages({ locale });

  return (
    <>
      {ga4Id && <Ga4Script measurementId={ga4Id} />}
      <PostHogProvider>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <LocaleHtmlLang />
          {children}
        </NextIntlClientProvider>
      </PostHogProvider>
    </>
  );
}