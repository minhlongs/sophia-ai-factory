import type { Metadata } from 'next';
import PricingPage from '@/components/stitch/screens/pricing/pricing-page';
import { buildCorePagePayload } from '@/seed/aeo';
import { normalizeAeoLocale } from '@/tree/aeo';
import { DualReadPageSection } from '@/forest/components/aeo';

const SITE_URL = 'https://sophia.agencyos.network';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}): Promise<Metadata> {
  const resolved = params ? await params : {};
  const locale = normalizeAeoLocale(resolved.locale);
  const isVi = locale === 'vi';
  const title = isVi
    ? 'Bảng giá Sophia AI Factory — BYOK AI Video & Affiliate RaaS'
    : 'Pricing — Sophia AI Factory BYOK AI Video & Affiliate RaaS';
  const description = isVi
    ? 'So sánh 4 gói BASIC, PREMIUM, ENTERPRISE và MASTER của Sophia AI Factory. Chi phí AI minh bạch theo cơ chế BYOK.'
    : 'Compare BASIC, PREMIUM, ENTERPRISE, and MASTER plans on Sophia AI Factory with transparent BYOK AI pricing.';
  const url = `${SITE_URL}/${locale}/pricing`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      locale: isVi ? 'vi_VN' : 'en_US',
      url,
      siteName: 'Sophia AI Factory',
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/twitter-card.png'],
    },
    alternates: {
      canonical: url,
      languages: {
        en: `${SITE_URL}/en/pricing`,
        vi: `${SITE_URL}/vi/pricing`,
        'x-default': `${SITE_URL}/en/pricing`,
      },
    },
  };
}

export default async function PricingRoute({
  params,
}: {
  params?: Promise<{ locale?: string }>;
}) {
  const resolved = params ? await params : {};
  const payload = buildCorePagePayload('pricing', normalizeAeoLocale(resolved.locale));

  return (
    <PricingPage
      beforeFooterSlot={<DualReadPageSection payload={payload} />}
    />
  );
}
