import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import {
  AFFILIATE_DISCLOSURE_REGIONS,
  AFFILIATE_DISCLOSURE_INTRO,
  AFFILIATE_DISCLOSURE_LEGAL_NOTICE,
  AFFILIATE_DISCLOSURE_CONSENT_NOTICE,
} from '@/land/compliance/affiliate-disclosure-content';

export const dynamic = 'force-dynamic';

interface AffiliateDisclosurePageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AffiliateDisclosurePageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: 'Nghĩa Vụ Công Khai Liên Kết / Affiliate Disclosure Rules | Sophia AI Factory',
    description:
      'Nghĩa vụ công khai hoa hồng cho đối tác theo khu vực (Mỹ, Anh, EU, Việt Nam) và câu mẫu sẵn dùng. Disclosure duties for partners by region (US, UK, EU, Vietnam) with ready-to-use sample sentences.',
    alternates: {
      canonical: `/${locale}/affiliate-disclosure`,
      languages: { en: '/en/affiliate-disclosure', vi: '/vi/affiliate-disclosure' },
    },
  };
}

export default async function AffiliateDisclosurePage({
  params,
}: AffiliateDisclosurePageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-screen bg-background py-16 px-4">
      <article className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-foreground mb-4">
          Nghĩa Vụ Công Khai Liên Kết
          <span className="block text-lg font-normal text-muted-foreground mt-1">
            Affiliate Disclosure Rules
          </span>
        </h1>

        <p className="text-muted-foreground mb-6">
          {AFFILIATE_DISCLOSURE_INTRO.vi}
          <br />
          <span className="text-xs">{AFFILIATE_DISCLOSURE_INTRO.en}</span>
        </p>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 mb-12">
          <p className="text-sm text-foreground">
            {AFFILIATE_DISCLOSURE_LEGAL_NOTICE.vi}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {AFFILIATE_DISCLOSURE_LEGAL_NOTICE.en}
          </p>
        </div>

        {AFFILIATE_DISCLOSURE_REGIONS.map((region) => (
          <section key={region.id} className="mb-12">
            <h2 className="text-xl font-semibold text-foreground mb-1">
              {region.label.vi}
              <span className="block text-sm font-normal text-muted-foreground">
                {region.label.en}
              </span>
            </h2>
            <p className="text-sm font-medium text-foreground mb-4">
              {region.headline.vi}
              <span className="block text-xs font-normal text-muted-foreground">
                {region.headline.en}
              </span>
            </p>

            <ol className="list-decimal space-y-3 pl-5 text-sm text-muted-foreground">
              {region.steps.map((step) => (
                <li key={step.en}>
                  <span className="block text-foreground">{step.vi}</span>
                  <span className="block text-xs text-muted-foreground">{step.en}</span>
                </li>
              ))}
            </ol>

            <div className="mt-4 rounded-lg border border-border bg-card p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                Câu mẫu / Sample sentence
              </p>
              <p className="text-sm text-foreground">
                “{region.sampleText.vi}”
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                “{region.sampleText.en}”
              </p>
            </div>
          </section>
        ))}

        <section className="mb-12">
          <h2 className="text-xl font-semibold text-foreground mb-4">
            Cookie và quy tắc theo dõi
            <span className="block text-sm font-normal text-muted-foreground">
              Cookies and tracking
            </span>
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-foreground">
              {AFFILIATE_DISCLOSURE_CONSENT_NOTICE.vi}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {AFFILIATE_DISCLOSURE_CONSENT_NOTICE.en}
            </p>
          </div>
        </section>

        <footer className="border-t border-border pt-6 text-xs text-muted-foreground">
          <p>
            Trang này cập nhật lần cuối vào tháng 10 năm 2026.
          </p>
          <p>Last updated October 2026.</p>
        </footer>
      </article>
    </main>
  );
}
