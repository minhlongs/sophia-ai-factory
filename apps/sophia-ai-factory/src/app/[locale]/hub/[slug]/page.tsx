/**
 * Owned Public Link-in-Bio Affiliate Storefront Micro-Hub (/hub/[slug]).
 *
 * Clean-room Next.js + Cloudflare Workers storefront with interactive CEX/SaaS
 * ROI calculator, /api/r/[code] attribution links, and zero-cookie design so
 * creators survive social platform bans.
 *
 * @module app/[locale]/hub/[slug]/page
 */

import { Link } from '@/navigation';
import { HubRoiCalculator } from './hub-roi-calculator';

export default async function PublicAffiliateHubPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const isVi = locale === 'vi';
  const safeSlug = slug.replace(/[^a-z0-9-_]/gi, '').slice(0, 48) || 'sophia';

  return (
    <main className="min-h-screen bg-background text-foreground px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg">
            {safeSlug.slice(0, 1).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">@{safeSlug}</h1>
          <p className="text-xs text-muted-foreground max-w-md">
            {isVi
              ? 'Cổng tổng hợp công cụ Crypto & SaaS đã kiểm duyệt tuân thủ • 100% link theo dõi chính chủ.'
              : 'Verified Crypto & SaaS Affiliate Hub • Policy-checked links & transparent disclosures.'}
          </p>
        </header>

        <HubRoiCalculator isVi={isVi} />

        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-semibold">
            {isVi ? 'Tài nguyên & Xác thực đối tác' : 'Partner Resources & Verified Proof'}
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs">
            <a
              href={`/api/media-kit/${encodeURIComponent(safeSlug)}`}
              className="rounded-lg border border-border px-3 py-2.5 font-medium hover:bg-muted transition-colors"
            >
              {isVi ? '🔐 Xem Verified Media Kit (JWS)' : '🔐 View Verified Media Kit (JWS)'}
            </a>
            <Link
              href="/guide"
              className="rounded-lg border border-border px-3 py-2.5 font-medium hover:bg-muted transition-colors"
            >
              {isVi ? '🧭 Hướng dẫn 5 phút Sophia' : '🧭 Sophia 5-Min Quickstart'}
            </Link>
          </div>
        </section>

        <footer className="text-center text-[11px] text-muted-foreground">
          {isVi
            ? '#QuảngCáo Liên kết tiếp thị (Affiliate). Không phải lời khuyên đầu tư tài chính.'
            : '#ad Affiliate Disclosure: We may earn a commission at no extra cost to you. Not financial advice.'}
        </footer>
      </div>
    </main>
  );
}
