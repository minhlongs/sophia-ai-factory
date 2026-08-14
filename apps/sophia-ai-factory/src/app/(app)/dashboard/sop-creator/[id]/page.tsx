import { Suspense } from 'react';
import { checkCreatorAccess } from '../ServerGate';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SOPCreatorListingPage({ params }: PageProps) {
  const { locale, id } = await params;
  const access = await checkCreatorAccess();
  const t = await getTranslations({ locale, namespace: 'sop.creator' }); // eslint-disable-line @typescript-eslint/no-unused-vars

  if (!access.hasAccess) {
    redirect(`/${locale}/dashboard/sop-creator/apply`);
  }

  if (!access.userId) {
    redirect(`/${locale}/auth/login?redirect=/dashboard/sop-creator/${id}`);
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading listing...</div>}>
      <ListingDetail locale={locale} listingId={id} userId={access.userId!} />
    </Suspense>
  );
}

async function ListingDetail({ locale, listingId, userId }: { locale: string; listingId: string; userId: string }) {
  const t = await getTranslations({ locale, namespace: 'sop.creator' });
  const tStatus = await getTranslations({ locale, namespace: 'sop.status' });

  // Fetch listing from database
  const { getD1 } = await import('@/seed/db/client');
  const { getSopListing } = await import('@/seed/db/marketplace-ops');

  const d1 = getD1();
  if (!d1) {
    return (
      <main className="min-h-screen bg-background p-8">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-muted-foreground">Database unavailable</p>
        </div>
      </main>
    );
  }

  const listing = await getSopListing(d1, listingId);

  if (!listing) {
    notFound();
  }

  // Verify ownership
  const { getCreatorProfile } = await import('@/seed/db/marketplace-ops');
  const { requireOrgMembership } = await import('@/seed/db/org-membership');
  const orgResult = await requireOrgMembership(userId);
  const tenantId = orgResult.authorized ? orgResult.orgId : 'default';
  const profile = await getCreatorProfile(d1, userId, tenantId);

  if (!profile || listing.creator_id !== profile.id) {
    notFound();
  }

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;
  const formatDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');

  const statusLabels: Record<string, string> = {
    draft: tStatus('draft'),
    published: tStatus('published'),
    archived: tStatus('archived'),
    pending_review: tStatus('pending_review'),
  };

  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <a
              href={`/${locale}/dashboard/sop-creator`}
              className="text-primary hover:underline text-sm mb-2 inline-block"
            >
              ← {t('dashboard.actions.myListings')}
            </a>
            <h1 className="text-2xl font-bold text-foreground">{listing.title}</h1>
            <p className="text-muted-foreground mt-1">{t('detail.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={listing.status} labels={statusLabels} />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <StatCard
            title={t('detail.stats.price')}
            value={formatPrice(listing.price_cents)}
            icon="DollarSign"
            variant="primary"
          />
          <StatCard
            title={t('detail.stats.installs')}
            value={listing.install_count.toString()}
            icon="Download"
            variant="default"
          />
          <StatCard
            title={t('detail.stats.rating')}
            value={listing.rating.toFixed(1)}
            icon="Star"
            variant="success"
          />
          <StatCard
            title={t('detail.stats.created')}
            value={formatDate(listing.created_at)}
            icon="Calendar"
            variant="muted"
          />
        </div>

        {/* Content Tabs */}
        <div className="space-y-6">
          {/* Basic Info */}
          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t('detail.sections.basicInfo')}</h3>
            <dl className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">{t('detail.fields.title')}</dt>
                <dd className="text-foreground font-medium mt-1">{listing.title}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('detail.fields.category')}</dt>
                <dd className="text-foreground font-medium mt-1">{listing.category || t('detail.fields.notSet')}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('detail.fields.sopTemplateId')}</dt>
                <dd className="text-foreground font-medium mt-1 font-mono text-sm">{listing.sop_template_id}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('detail.fields.status')}</dt>
                <dd className="text-foreground font-medium mt-1">
                  <StatusBadge status={listing.status} labels={statusLabels} />
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">{t('detail.fields.description')}</dt>
                <dd className="text-foreground font-medium mt-1 whitespace-pre-wrap">{listing.description || t('detail.fields.noDescription')}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">{t('detail.fields.tags')}</dt>
                <dd className="text-foreground font-medium mt-1">
                  {listing.tags
                    ? JSON.parse(listing.tags).map((tag: string) => (
                        <span key={tag} className="inline-block px-2 py-1 bg-muted rounded text-sm mr-2 mb-2">
                          {tag}
                        </span>
                      ))
                    : t('detail.fields.noTags')}
                </dd>
              </div>
            </dl>
          </div>

          {/* Media */}
          {(listing.thumbnail_url || listing.demo_video_url) && (
            <div className="bg-card border rounded-xl p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">{t('detail.sections.media')}</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {listing.thumbnail_url && (
                  <div>
                    <dt className="text-muted-foreground text-sm mb-2">{t('detail.fields.thumbnail')}</dt>
                    <img
                      src={listing.thumbnail_url}
                      alt="Thumbnail"
                      className="rounded-lg border max-h-48 w-full object-cover"
                    />
                  </div>
                )}
                {listing.demo_video_url && (
                  <div>
                    <dt className="text-muted-foreground text-sm mb-2">{t('detail.fields.demoVideo')}</dt>
                    <a
                      href={listing.demo_video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline inline-flex items-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {t('detail.fields.viewVideo')}
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="bg-card border rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">{t('detail.actions.title')}</h3>
            <div className="flex flex-wrap gap-4">
              {listing.status === 'draft' && (
                <>
                  <a
                    href={`/${locale}/dashboard/sop-creator/${listingId}/edit`}
                    className="btn btn-primary"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {t('detail.actions.edit')}
                  </a>
                  <button
                    className="btn btn-secondary"
                    onClick={() => submitForReview(listingId, locale)}
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {t('detail.actions.submitForReview')}
                  </button>
                </>
              )}
              {listing.status === 'pending_review' && (
                <span className="btn btn-secondary flex items-center gap-2 opacity-50 cursor-not-allowed">
                  <Clock className="w-4 h-4" />
                  {t('detail.actions.underReview')}
                </span>
              )}
              {listing.status === 'published' && (
                <>
                  <a
                    href={`/${locale}/dashboard/sop-creator/${listingId}/edit`}
                    className="btn btn-secondary"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    {t('detail.actions.edit')}
                  </a>
                  <button
                    className="btn btn-destructive"
                    onClick={() => archiveListing(listingId, locale)}
                  >
                    <Archive className="w-4 h-4 mr-2" />
                    {t('detail.actions.archive')}
                  </button>
                </>
              )}
              {listing.status === 'archived' && (
                <span className="btn btn-secondary flex items-center gap-2 opacity-50 cursor-not-allowed">
                  <Archive className="w-4 h-4" />
                  {t('detail.actions.archived')}
                </span>
              )}
              <a
                href={`/${locale}/dashboard/sop-marketplace/${listingId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('detail.actions.viewInMarketplace')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Helper components
function StatusBadge({
  status,
  labels,
}: {
  status: string;
  labels: Record<string, string>;
}) {
  const statusConfig: Record<string, { bg: string; text: string }> = {
    draft: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
    published: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
    archived: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
    pending_review: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  };

  const config = statusConfig[status] || statusConfig.draft;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      {labels[status] || status}
    </span>
  );
}

function StatCard({
  title,
  value,
  icon,
  variant = 'default',
}: {
  title: string;
  value: string;
  icon: string;
  variant?: 'default' | 'muted' | 'success' | 'primary';
}) {
  const iconMap: Record<string, React.ReactNode> = {
    DollarSign: <DollarSign className="w-5 h-5" />,
    Download: <Download className="w-5 h-5" />,
    Star: <Star className="w-5 h-5" />,
    Calendar: <Calendar className="w-5 h-5" />,
  };

  const variantClasses = {
    default: 'bg-card border',
    muted: 'bg-card border border-muted',
    success: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    primary: 'bg-primary/10 border-primary/30',
  };

  return (
    <div className={variantClasses[variant] + ' rounded-lg p-5'}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="text-primary">{iconMap[icon]}</div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

// Client-side actions
async function submitForReview(listingId: string, locale: string) {
  const res = await fetch(`/${locale}/dashboard/sop-creator/${listingId}/submit-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.ok) {
    window.location.reload();
  }
}

async function archiveListing(listingId: string, locale: string) {
  if (!confirm('Are you sure you want to archive this listing?')) return;
  const res = await fetch(`/${locale}/dashboard/sop-creator/${listingId}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.ok) {
    window.location.reload();
  }
}

import { DollarSign, Download, Star, Calendar, Edit, Send, Clock, Archive, ExternalLink } from 'lucide-react';
