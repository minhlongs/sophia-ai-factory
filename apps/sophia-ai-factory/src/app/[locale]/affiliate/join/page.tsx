import { setRequestLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { AffiliateJoinView } from './join-view';

export const dynamic = 'force-dynamic';

const BILINGUAL_TITLE = 'Trở Thành Đối Tác / Become an Affiliate Partner | Sophia AI Factory';
const BILINGUAL_DESCRIPTION =
  'Đăng ký chương trình đối tác Sophia AI Factory: hoa hồng đến 30% theo gói khách mua, cửa sổ 30 ngày, thanh toán NET-30. ' +
  'Join the Sophia AI Factory partner programme: up to 30% commission by the referred plan, 30-day window, NET-30 payouts.';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return {
    title: BILINGUAL_TITLE,
    description: BILINGUAL_DESCRIPTION,
    alternates: {
      canonical: `/${locale}/affiliate/join`,
      languages: { en: '/en/affiliate/join', vi: '/vi/affiliate/join' },
    },
  };
}

export default async function AffiliateJoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, user] = await Promise.all([
    getTranslations({ locale, namespace: 'affiliateProgram' }),
    getCurrentUser(),
  ]);

  return (
    <AffiliateJoinView
      signupHref={`/${locale}/register`}
      loginHref={`/${locale}/login?next=/${locale}/affiliate/join`}
      termsHref={`/${locale}/affiliate-terms`}
      disclosureHref={`/${locale}/affiliate-disclosure`}
      isSignedIn={Boolean(user)}
      t={t}
    />
  );
}
