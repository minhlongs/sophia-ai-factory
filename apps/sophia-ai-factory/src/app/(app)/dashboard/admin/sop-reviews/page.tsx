import { checkCreatorAccess } from '@/app/(app)/dashboard/sop-creator/ServerGate';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

interface PageProps {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AdminSOPReviewsPage({ params }: PageProps) {
  const { locale } = await params;
  const access = await checkAdminAccess();
  const t = await getTranslations({ locale, namespace: 'admin' });

  // Check if user is admin
  if (!access.isAdmin) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <Suspense fallback={<div className="p-8 text-center">Loading admin reviews...</div>}>
      <AdminSOPReviewsContent locale={locale} userId={access.userId!} />
    </Suspense>
  );
}

async function checkAdminAccess(): Promise<{ hasAccess: boolean; isAdmin: boolean; userId: string | null }> {
  const { getCurrentUser } = await import('@/seed/auth/better-auth-session');
  const { getUserTier } = await import('@/seed/db/get-user-tier');

  const user = await getCurrentUser();
  if (!user) {
    return { hasAccess: false, isAdmin: false, userId: null };
  }

  const tier = await getUserTier(user.id);
  const isAdmin = tier === 'MASTER' || tier === 'ENTERPRISE';

  return { hasAccess: isAdmin, isAdmin, userId: user.id };
}

async function AdminSOPReviewsContent({ locale, userId }: { locale: string; userId: string }) {
  const t = await getTranslations({ locale, namespace: 'admin.sopReviews' });
  const tSopStatus = await getTranslations({ locale, namespace: 'sop.status' });

  // Fetch pending review listings
  const { getD1 } = await import('@/seed/db/client');
  const d1 = getD1();

  if (!d1) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-muted-foreground">Database unavailable</p>
        </div>
      </div>
    );
  }

  const pendingListings = await d1
    .prepare(
      `SELECT sl.*, cp.display_name as creator_name, cp.user_id as creator_user_id
       FROM sop_listings sl
       JOIN creator_profiles cp ON sl.creator_id = cp.id
       WHERE sl.status = 'pending_review'
       ORDER BY sl.created_at ASC`
    )
    .all();

  const publishedListings = await d1
    .prepare(
      `SELECT sl.*, cp.display_name as creator_name, cp.user_id as creator_user_id
       FROM sop_listings sl
       JOIN creator_profiles cp ON sl.creator_id = cp.id
       WHERE sl.status = 'published'
       ORDER BY sl.updated_at DESC
       LIMIT 20`
    )
    .all();

  const formatDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US');
  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const statusLabels: Record<string, string> = {
    draft: tSopStatus('draft'),
    published: tSopStatus('published'),
    archived: tSopStatus('archived'),
    pending_review: tSopStatus('pending_review'),
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <StatCard
            title={t('stats.pending')}
            value={pendingListings.results?.length.toString() || '0'}
            icon="Clock"
            variant="warning"
          />
          <StatCard
            title={t('stats.published')}
            value={publishedListings.results?.length.toString() || '0'}
            icon="CheckCircle"
            variant="success"
          />
          <StatCard
            title={t('stats.total')}
            value={((pendingListings.results?.length || 0) + (publishedListings.results?.length || 0)).toString()}
            icon="FileText"
            variant="primary"
          />
        </div>

        {/* Pending Reviews Table */}
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">{t('sections.pendingReviews')}</h2>
          </div>

          {pendingListings.results && pendingListings.results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-4 font-medium">{t('table.columns.title')}</th>
                    <th className="p-4 font-medium">{t('table.columns.creator')}</th>
                    <th className="p-4 font-medium">{t('table.columns.category')}</th>
                    <th className="p-4 font-medium">{t('table.columns.price')}</th>
                    <th className="p-4 font-medium">{t('table.columns.submitted')}</th>
                    <th className="p-4 font-medium">{t('table.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingListings.results.map((listing: any) => (
                    <tr key={listing.id} className="border-b hover:bg-muted/30">
                      <td className="p-4">
                        <div className="font-medium text-foreground">{listing.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {listing.sop_template_id}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-foreground">{listing.creator_name}</div>
                        <div className="text-sm text-muted-foreground">{listing.creator_user_id}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-muted rounded text-sm text-muted-foreground">
                          {listing.category || t('table.uncategorized')}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-foreground">
                        {formatPrice(listing.price_cents)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(listing.created_at)}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <a
                            href={`/${locale}/dashboard/sop-creator/${listing.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-secondary"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            {t('actions.view')}
                          </a>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => approveListing(listing.id, locale)}
                          >
                            <Check className="w-4 h-4 mr-1" />
                            {t('actions.approve')}
                          </button>
                          <button
                            className="btn btn-sm btn-destructive"
                            onClick={() => rejectListing(listing.id, locale)}
                          >
                            <X className="w-4 h-4 mr-1" />
                            {t('actions.reject')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.pending.title')}</h3>
              <p className="text-muted-foreground">{t('empty.pending.description')}</p>
            </div>
          )}
        </div>

        {/* Published Listings Table */}
        <div className="mt-8 bg-card border rounded-xl overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <h2 className="text-lg font-semibold text-foreground">{t('sections.publishedListings')}</h2>
          </div>

          {publishedListings.results && publishedListings.results.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="p-4 font-medium">{t('table.columns.title')}</th>
                    <th className="p-4 font-medium">{t('table.columns.creator')}</th>
                    <th className="p-4 font-medium">{t('table.columns.category')}</th>
                    <th className="p-4 font-medium">{t('table.columns.price')}</th>
                    <th className="p-4 font-medium">{t('table.columns.installs')}</th>
                    <th className="p-4 font-medium">{t('table.columns.rating')}</th>
                    <th className="p-4 font-medium">{t('table.columns.updated')}</th>
                    <th className="p-4 font-medium">{t('table.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedListings.results.map((listing: any) => (
                    <tr key={listing.id} className="border-b hover:bg-muted/30">
                      <td className="p-4">
                        <div className="font-medium text-foreground">{listing.title}</div>
                        <div className="text-sm text-muted-foreground truncate max-w-xs">
                          {listing.sop_template_id}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-foreground">{listing.creator_name}</div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-muted rounded text-sm text-muted-foreground">
                          {listing.category || t('table.uncategorized')}
                        </span>
                      </td>
                      <td className="p-4 font-medium text-foreground">
                        {formatPrice(listing.price_cents)}
                      </td>
                      <td className="p-4 text-foreground">
                        {listing.install_count}
                      </td>
                      <td className="p-4 text-foreground">
                        {listing.rating.toFixed(1)}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {formatDate(listing.updated_at)}
                      </td>
                      <td className="p-4">
                        <a
                          href={`/${locale}/dashboard/sop-creator/${listing.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-sm btn-secondary"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          {t('actions.view')}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center">
              <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">{t('empty.published.title')}</h3>
              <p className="text-muted-foreground">{t('empty.published.description')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Client-side actions
async function approveListing(listingId: string, locale: string) {
  const res = await fetch(`/${locale}/dashboard/admin/sop-reviews/${listingId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.ok) {
    window.location.reload();
  }
}

async function rejectListing(listingId: string, locale: string) {
  const reason = prompt('Rejection reason (optional):');
  const res = await fetch(`/${locale}/dashboard/admin/sop-reviews/${listingId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason: reason || 'Not approved by admin' }),
  });
  if (res.ok) {
    window.location.reload();
  }
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
  variant?: 'default' | 'muted' | 'success' | 'primary' | 'warning';
}) {
  const iconMap: Record<string, React.ReactNode> = {
    Clock: <Clock className="w-5 h-5" />,
    CheckCircle: <CheckCircle className="w-5 h-5" />,
    FileText: <FileText className="w-5 h-5" />,
  };

  const variantClasses = {
    default: 'bg-card border',
    muted: 'bg-card border border-muted',
    success: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
    primary: 'bg-primary/10 border-primary/30',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
  };

  return (
    <div className={variantClasses[variant] + ' rounded-lg p-6'}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{title}</span>
        <div className="text-primary">{iconMap[icon]}</div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

import { Clock, CheckCircle, FileText, Eye, Check, X, FileText as FileTextIcon } from 'lucide-react';
import { cn } from '@/seed/utils/cn';
import { Button } from '@/seed/components/ui/button';