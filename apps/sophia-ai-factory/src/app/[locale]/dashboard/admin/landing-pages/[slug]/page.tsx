/**
 * Admin Landing Pages — Edit / Create Page
 *
 * Server shell: loads existing page data (edit mode) or passes null (create mode).
 * Renders the LandingPagesEditor client component.
 *
 * @route /dashboard/admin/landing-pages/[slug]
 * @route /dashboard/admin/landing-pages/new (create mode)
 */

import { notFound } from 'next/navigation';
import { requireMasterTier } from '@/seed/auth/require-master-tier';
import { getBySlug } from '@/seed/db/repositories/landing-pages-repo';
import { LandingPagesEditor } from '../landing-pages-editor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function AdminLandingPageEdit({ params }: PageProps) {
  await requireMasterTier();

  const { locale, slug } = await params;

  // Create mode
  if (slug === 'new') {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <LandingPagesEditor locale={locale} initialData={null} />
      </div>
    );
  }

  // Edit mode — load existing page
  const page = await getBySlug(slug);
  if (!page) notFound();

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <LandingPagesEditor locale={locale} initialData={page} />
    </div>
  );
}
