import type { Metadata } from 'next';
import { ReactNode } from 'react';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { LocaleHtmlLang } from '@/components/locale-html-lang';
import { PostHogProvider } from '@/forest/components/posthog-provider';
import { Ga4Script } from '@/land/analytics/ga4-script';
import { getCspNonce } from '@/seed/security/get-csp-nonce';
import { getTenantBrandingByHostname } from '@/tree/branding/org-branding-repo';
import { buildThemeCssString } from '@/tree/branding/theme-resolver';
import { getD1 } from '@/seed/db/client';
import { WhiteLabelThemeStyle } from '@/forest/theme/white-label-theme-style';
import { WhiteLabelBrandProvider } from '@/forest/theme/white-label-context';
import type { ResolvedTenantBranding } from '@/seed/types/white-label-branding';
import { extractHostname, isInternalOrCanonicalHostname } from '@/tree/custom-domains/hostname-resolver';

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

async function resolveCurrentTenantBranding(): Promise<ResolvedTenantBranding | null> {
  try {
    const headerList = await headers();
    const isWhitelabel = headerList.get('x-whitelabel-active');

    // Fast path: only perform custom domain branding query if whitelabel is active
    if (isWhitelabel !== 'true') {
      return null;
    }

    const customDomain = headerList.get('x-custom-domain');
    const rawHost = customDomain ? decodeURI(customDomain) : extractHostname(headerList);
    if (!rawHost || isInternalOrCanonicalHostname(rawHost)) {
      return null;
    }

    const db = await getD1();
    if (!db) return null;

    return await getTenantBrandingByHostname(db, rawHost);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const defaultMeta = localeMetadata[locale] ?? localeMetadata.vi;

  const branding = await resolveCurrentTenantBranding();
  if (branding?.isWhiteLabel) {
    const brandTitle = branding.agencyName
      ? `${branding.agencyName} — ${defaultMeta.title}`
      : defaultMeta.title;
    return {
      ...defaultMeta,
      title: brandTitle,
      icons: branding.faviconUrl ? [{ rel: 'icon', url: branding.faviconUrl }] : undefined,
    };
  }

  return defaultMeta;
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

  const branding = await resolveCurrentTenantBranding();
  const themeCss = branding ? buildThemeCssString(branding) : null;
  const nonce = await getCspNonce();

  return (
    <>
      <WhiteLabelThemeStyle themeCss={themeCss} nonce={nonce} />
      {ga4Id && <Ga4Script measurementId={ga4Id} />}
      <PostHogProvider>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <WhiteLabelBrandProvider branding={branding}>
            <LocaleHtmlLang />
            {children}
          </WhiteLabelBrandProvider>
        </NextIntlClientProvider>
      </PostHogProvider>
    </>
  );
}