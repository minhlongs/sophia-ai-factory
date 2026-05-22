/**
 * /dashboard/sop-marketplace — SOP Marketplace browse page.
 *
 * Server Component: fetches official templates + user installs + community listings.
 * Renders SopGrid (client) for official SOPs, plus community section with purchase flow.
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { getUserTier } from '@/seed/db/get-user-tier';
import { getSopInstallLimit } from '@/seed/config/tiers';
import {
  listOfficialTemplates,
  listInstallationsForUser,
  listPublishedListings,
  listUserLicenses,
} from '@/lib/sop/sop-repo';
import { SopGrid } from '@/forest/components/sop/sop-grid';
import { CommunityListingCard } from './community-listing-card';
import { installSopAction } from './actions';
import { Store, Sparkles, Users } from 'lucide-react';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'SOP Marketplace | Sophia AI' };
}

function getD1(): D1Database | null {
  try {
    const env = (globalThis as unknown as Record<string, Record<string, unknown>>).__env;
    if (env?.DB) return env.DB as D1Database;
    const globalDb = (globalThis as Record<string, unknown>).__D1_DB as D1Database | undefined;
    return globalDb ?? null;
  } catch { return null; }
}

export default async function MarketplacePage({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations('sop.marketplace');
  const tCommunity = await getTranslations('sop.community');

  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/login`);

  const db = getD1();
  const [templates, installations, listings, licenses] = await Promise.all([
    db ? listOfficialTemplates(db) : Promise.resolve([]),
    db ? listInstallationsForUser(db, user.id) : Promise.resolve([]),
    db ? listPublishedListings(db) : Promise.resolve([]),
    db ? listUserLicenses(db, user.id) : Promise.resolve([]),
  ]);

  const installedTemplateIds = installations.map(i => i.template_id);
  const licensedTemplateIds = new Set(licenses.map(l => l.template_id));

  const tier = await getUserTier(user.id);
  const sopLimit = getSopInstallLimit(tier);

  const isVi = locale.startsWith('vi');
  const isFirstTime = installations.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Store className="w-6 h-6 text-violet-400" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
      </div>

      {isFirstTime && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-950/20 p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-semibold text-violet-100">
              {isVi ? 'Lần đầu cài SOP?' : 'First time installing a SOP?'}
            </h2>
            <p className="text-xs text-zinc-300 leading-relaxed">
              {isVi
                ? '3 bước: (1) chọn template phù hợp dưới đây, (2) bấm Install, (3) vào /dashboard/sops bấm Run để tạo video đầu tiên. Mất ~5 phút.'
                : '3 steps: (1) pick a template below, (2) click Install, (3) go to /dashboard/sops and click Run to generate your first video. ~5 minutes total.'}
            </p>
            <Link
              href="/dashboard/help/faq"
              className="inline-block mt-1 text-xs text-violet-300 hover:text-violet-200 underline"
            >
              {isVi ? 'Xem FAQ về SOPs →' : 'Read SOP FAQ →'}
            </Link>
          </div>
        </div>
      )}

      <SopGrid
        templates={templates}
        installedTemplateIds={installedTemplateIds}
        locale={locale}
        installAction={installSopAction}
        installCount={installations.length}
        sopInstallLimit={sopLimit}
      />

      {/* Community SOPs section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-violet-400" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{tCommunity('title')}</h2>
            <p className="text-xs text-muted-foreground">{tCommunity('subtitle')}</p>
          </div>
        </div>

        {listings.length === 0 ? (
          <p className="text-sm text-zinc-500 py-4">{tCommunity('noListings')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => (
              <CommunityListingCard
                key={listing.id}
                listing={listing}
                isPurchased={licensedTemplateIds.has(listing.template_id)}
                locale={locale}
                buyLabel={tCommunity('buy')}
                purchasedLabel={tCommunity('purchased')}
                byLabel={tCommunity('bySeller')}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
