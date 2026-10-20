import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import {
  AFFILIATE_TERMS_SECTIONS,
  AFFILIATE_TERMS_INTRO,
  AFFILIATE_COMMISSION_TIERS,
  AFFILIATE_PAYOUT_RULES,
} from '@/land/compliance/affiliate-terms-content';

export const dynamic = 'force-dynamic';

interface AffiliateTermsPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AffiliateTermsPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Điều Khoản Chương Trình Đối Tác / Affiliate Program Terms | Sophia AI Factory',
    description:
      'Quy tắc hoa hồng, thanh toán NET-30 và chống gian lận cho đối tác Sophia AI Factory. Affiliate commission rates, NET-30 payouts and anti-fraud rules for Sophia AI Factory partners.',
    alternates: {
      canonical: `/${locale}/affiliate-terms`,
      languages: { en: '/en/affiliate-terms', vi: '/vi/affiliate-terms' },
    },
  };
}

/** One bilingual commission tier row. */
function CommissionRow({
  tier,
}: {
  tier: (typeof AFFILIATE_COMMISSION_TIERS)[number];
}) {
  const repeat = tier.repeatsMonths
    ? {
        vi: `${tier.repeatsMonths} tháng`,
        en: `${tier.repeatsMonths} months`,
      }
    : { vi: 'Một lần', en: 'One-time' };

  return (
    <tr className="border-b border-border">
      <td className="py-3 pr-4 align-top">
        <span className="font-semibold text-foreground">{tier.name.vi}</span>
        <span className="block text-xs text-muted-foreground">{tier.name.en}</span>
      </td>
      <td className="py-3 pr-4 align-top text-foreground">
        ${tier.priceUsd}
        <span className="block text-xs text-muted-foreground">
          {tier.billing.vi}
          <span className="block text-xs text-muted-foreground">{tier.billing.en}</span>
        </span>
      </td>
      <td className="py-3 pr-4 align-top text-foreground">
        {tier.commissionPercent}%
      </td>
      <td className="py-3 align-top text-foreground">
        {repeat.vi}
        <span className="block text-xs text-muted-foreground">{repeat.en}</span>
      </td>
    </tr>
  );
}

/** Bilingual bullet list with Vietnamese first. */
function BilingualBullets({
  bullets,
}: {
  bullets: readonly { vi: string; en: string }[];
}) {
  return (
    <ul className="list-disc space-y-3 pl-5 text-sm text-muted-foreground">
      {bullets.map((bullet) => (
        <li key={bullet.en}>
          <span className="block text-foreground">{bullet.vi}</span>
          <span className="block text-xs text-muted-foreground">{bullet.en}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function AffiliateTermsPage({
  params,
}: AffiliateTermsPageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <article className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Điều Khoản Chương Trình Đối Tác
          <span className="block text-lg font-normal text-muted-foreground mt-1">
            Affiliate Program Terms
          </span>
        </h1>

        <p className="text-muted-foreground mb-10">
          {AFFILIATE_TERMS_INTRO.vi}
          <br />
          <span className="text-xs">{AFFILIATE_TERMS_INTRO.en}</span>
        </p>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Mức hoa hồng theo gói
            <span className="block text-sm font-normal text-muted-foreground">
              Commission rate by plan
            </span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 pr-4">Gói / Plan</th>
                  <th className="pb-2 pr-4">Giá / Price</th>
                  <th className="pb-2 pr-4">Hoa hồng / Rate</th>
                  <th className="pb-2">Thời hạn / Duration</th>
                </tr>
              </thead>
              <tbody>
                {AFFILIATE_COMMISSION_TIERS.map((tier) => (
                  <CommissionRow key={tier.tier} tier={tier} />
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Quy tắc thanh toán và theo dõi
            <span className="block text-sm font-normal text-muted-foreground">
              Payout and tracking rules
            </span>
          </h2>
          <dl className="space-y-3">
            {AFFILIATE_PAYOUT_RULES.map((rule) => (
              <div
                key={rule.label.en}
                className="rounded-lg border border-border bg-card p-4"
              >
                <dt className="text-sm font-semibold text-foreground">
                  {rule.label.vi}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {rule.label.en}
                  </span>
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {rule.value.vi}
                  <span className="block text-xs">{rule.value.en}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {AFFILIATE_TERMS_SECTIONS.map((section) => (
          <section key={section.id} className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-4">
              {section.title.vi}
              <span className="block text-sm font-normal text-muted-foreground">
                {section.title.en}
              </span>
            </h2>
            <BilingualBullets bullets={section.bullets} />
          </section>
        ))}

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            Trang này cập nhật lần cuối vào tháng 10 năm 2026 và có hiệu lực cho mọi đối tác
            mới.
          </p>
          <p>
            Last updated October 2026. These terms apply to all new partners.
          </p>
        </footer>
      </article>
    </main>
  );
}
