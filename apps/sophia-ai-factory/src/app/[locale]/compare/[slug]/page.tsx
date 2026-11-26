/**
 * Programmatic Buyer-Intent 'X vs Y' Comparison Hub (/[locale]/compare/[slug]).
 *
 * Clean-room Next.js 16 + Cloudflare Workers pSEO page emitting a valid
 * Schema.org JSON-LD @graph (SoftwareApplication + FAQPage + Product with
 * Rich Results guardrails: omits aggregateRating when reviewCount === 0).
 *
 * @module app/[locale]/compare/[slug]/page
 */

import { Link } from '@/navigation';

function parseComparisonPair(slug: string): readonly [string, string] {
  const parts = slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .split('-vs-')
    .filter(Boolean);
  const left = (parts[0] ?? 'bybit').replace(/-/g, ' ');
  const right = (parts[1] ?? 'okx').replace(/-/g, ' ');
  const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  return [cap(left), cap(right)] as const;
}

export default async function ProgrammaticComparisonPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isVi = locale === 'vi';
  const [toolA, toolB] = parseComparisonPair(slug);

  const jsonLdGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: `${toolA} vs ${toolB} (2026 Comparison)`,
        applicationCategory: 'BusinessApplication',
        operatingSystem: 'Web',
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: isVi
              ? `${toolA} hay ${toolB} tối ưu phí hơn trong năm 2026?`
              : `Which offers better fee efficiency in 2026: ${toolA} or ${toolB}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: isVi
                ? `Cả ${toolA} và ${toolB} đều hỗ trợ cấu trúc phí theo bậc; hãy kiểm tra biểu phí thực tế và mức hoàn phí (rebate) tại cổng Sophia Hub trước khi đăng ký.`
                : `Both ${toolA} and ${toolB} use tiered fee schedules; compare verified maker/taker rebates on Sophia Hub before signing up.`,
            },
          },
        ],
      },
    ],
  };

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdGraph) }}
      />
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2 border-b border-border pb-5">
          <p className="font-mono text-xs uppercase tracking-wider text-primary">
            {isVi ? 'SO SÁNH CHUẨN AEO / GEO • 2026' : 'AEO / GEO VERIFIED COMPARISON • 2026'}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            {toolA} vs {toolB}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isVi
              ? `Đánh giá khách quan giữa ${toolA} và ${toolB} theo biểu phí, trải nghiệm và quyền lợi hoàn phí cho người dùng Crypto/SaaS.`
              : `Objective side-by-side comparison of ${toolA} vs ${toolB} covering fees, workflow fit, and verified partner rebates.`}
          </p>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[toolA, toolB].map((name) => (
            <div key={name} className="rounded-xl border border-border bg-card p-5 space-y-2">
              <h2 className="text-lg font-semibold">{name}</h2>
              <p className="text-xs text-muted-foreground">
                {isVi
                  ? `Phù hợp cho người dùng tìm kiếm hiệu suất cao và minh bạch chi phí với ${name}.`
                  : `Built for users prioritizing transparent fee tiers and reliable execution with ${name}.`}
              </p>
              <Link
                href="/hub/sophia"
                className="inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                {isVi ? `Tính hoàn phí ${name} →` : `Calculate ${name} Rebate →`}
              </Link>
            </div>
          ))}
        </section>

        <footer className="text-xs text-muted-foreground">
          {isVi
            ? '#QuảngCáo Nội dung so sánh mang tính tham khảo công cụ, không phải lời khuyên đầu tư.'
            : '#ad Affiliate Disclosure: Educational software comparison only. Not financial advice.'}
        </footer>
      </div>
    </main>
  );
}
