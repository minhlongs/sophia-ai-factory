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
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { getSopInstallLimit } from '@/seed/config/tiers';
import {
  listOfficialTemplates,
  listInstallationsForUser,
  listPublishedListings,
  listUserLicenses,
} from '@/tree/sop/sop-repo';
import { fetchAuthorBrandings } from '@/tree/branding/org-branding-repo';
import { SopGrid } from '@/forest/components/sop/sop-grid';
import { CommunityListingCard } from './community-listing-card';
import { installSopAction } from './actions';
import { Store, Sparkles, Users } from 'lucide-react';
import { RouteHelpTooltip } from '@/components/help/route-help-tooltip';
import { getD1 } from '@/seed/db/get-d1';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  const t = await getTranslations('sop.marketplace');
  return { title: t('pageTitle') };
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

  // Fetch branding for community listing authors
  const authorIds = [...new Set(listings.map(l => l.author_user_id).filter((id): id is string => !!id))];
  const authorBrandings = db
    ? await fetchAuthorBrandings(db, authorIds)
    : new Map<string, never>();

  const tier = await resolveUserTier(user.id);
  const sopLimit = getSopInstallLimit(tier);


  const isFirstTime = installations.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Store className="w-6 h-6 text-primary-400" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('subtitle')}</p>
        </div>
        <RouteHelpTooltip locale={locale} routeKey="sop-marketplace" />
      </div>

      {isFirstTime && (
        <div className="rounded-xl border border-primary-500/30 bg-primary-950/20 p-4 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-primary-300 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 space-y-1">
            <h2 className="text-sm font-semibold text-primary-100">
              {t('firstTimeTitle')}
            </h2>
            <p className="text-xs text-muted-foreground-300 leading-relaxed">
              {t('firstTimeDesc')}
            </p>
            <Link
              href="/dashboard/help/faq"
              className="inline-block mt-1 text-xs text-primary-300 hover:text-primary-200 underline"
            >
              {t('firstTimeFaq')}
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
        <div className="flex flex-wrap items-center gap-2">
          <Users className="w-5 h-5 text-primary-400" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">{tCommunity('title')}</h2>
            <p className="text-xs text-muted-foreground">{tCommunity('subtitle')}</p>
          </div>
        </div>

        {listings.length === 0 ? (
          <p className="text-sm text-muted-foreground-500 py-4">{tCommunity('noListings')}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map(listing => {
              const authorBranding = listing.author_user_id
                ? authorBrandings.get(listing.author_user_id)
                : null;
              return (
                <CommunityListingCard
                  key={listing.id}
                  listing={listing}
                  isPurchased={licensedTemplateIds.has(listing.template_id)}
                  locale={locale}
                  buyLabel={tCommunity('buy')}
                  purchasedLabel={tCommunity('purchased')}
                  byLabel={tCommunity('bySeller')}
                  brandName={authorBranding?.agencyName ?? null}
                  brandLogoUrl={authorBranding?.logoUrl ?? null}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
