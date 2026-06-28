/**
 * /[locale]/redeem — Public FREE100 (and other free promo) redemption page.
 * Customers paste email + name + code; backend creates account, sends
 * magic link to their inbox. Bilingual vi/en.
 *
 * @module app/[locale]/redeem/page
 */

import { RedeemPageClient } from './redeem-page-client';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ code?: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const isVi = locale.startsWith('vi');
  return {
    title: isVi ? 'Kích hoạt mã quà tặng — Sophia AI' : 'Redeem Promo Code — Sophia AI',
    description: isVi
      ? 'Nhập email và mã quà tặng để nhận tài khoản Sophia AI Factory miễn phí.'
      : 'Enter your email and promo code to claim your free Sophia AI Factory account.',
  };
}

export default async function RedeemPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { code } = await searchParams;
  const isVi = locale.startsWith('vi');

  return <RedeemPageClient locale={locale} isVi={isVi} initialCode={code ?? ''} />;
}
