/**
 * Admin Landing Pages — List Page
 *
 * Shows all landing pages with publish status, quick actions, and summary stats.
 * EN-only per admin i18n policy (docs/code-standards.md#admin-i18n-policy).
 *
 * @route /dashboard/admin/landing-pages
 */

import Link from 'next/link';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { listAll } from '@/seed/db/repositories/landing-pages-repo';
import { AdminDataTable } from './admin-data-table';

export const dynamic = 'force-dynamic';

export default async function AdminLandingPagesPage() {
  await requireMasterTier();

  const pages = await listAll();
  const publishedCount = pages.filter((p) => p.isPublished).length;
  const unpublishedCount = pages.length - publishedCount;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Landing Pages
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage programmatic SEO landing pages for niche AI video content.
          </p>
        </div>
        <Link
          href="/dashboard/admin/landing-pages/new"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Page
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{pages.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Pages</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-2xl font-bold text-green-600">{publishedCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Published</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-2xl font-bold text-yellow-600">{unpublishedCount}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Unpublished</p>
        </div>
      </div>

      {/* Table */}
      <AdminDataTable
        pages={pages.map((p) => ({
          id: p.id,
          nicheLabel: p.nicheLabel,
          isPublished: p.isPublished,
          updatedAt: p.updatedAt,
        }))}
      />
    </div>
  );
}
