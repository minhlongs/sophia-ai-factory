import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { LocaleHtmlLang } from '@/components/locale-html-lang';
import { PostHogProvider } from '@/forest/components/posthog-provider';
import { Ga4Script } from '@/land/analytics/ga4-script';

const ga4Id = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

const localeMetadata: Record<string, Metadata> = {
  vi: {
    title: 'Sophia AI Factory — Nền tảng tạo video AI',
    description:
      'Tạo video AI cho kênh YouTube vô danh và xây dựng đế chế affiliate marketing.',
  },
  en: {
    title: 'Sophia AI Factory — AI Video Generation Platform',
    description:
      'Generate AI-powered videos for faceless YouTube channels and affiliate marketing empires.',
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return localeMetadata[locale] ?? localeMetadata.vi;
}

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