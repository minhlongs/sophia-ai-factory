/**
 * /sop-marketplace — Public marketplace listing.
 *
 * Server Component: fetches published SOP templates from the public API
 * and renders a searchable / filterable card grid via MarketplaceClient.
 */
import { Metadata } from 'next';
import MarketplaceClient from './marketplace-client';

export const metadata: Metadata = {
  title: 'SOP Marketplace | Sophia AI Factory',
  description: 'Browse and install verified SOP templates for your agency workflows.',
};

export const dynamic = 'force-dynamic';

const CATEGORIES = [
  'all',
  'onboarding',
  'video',
  'social',
  'sales',
  'support',
  'finance',
] as const;

export type Category = (typeof CATEGORIES)[number];

type PageTemplate = Record<string, unknown>;

export default async function SopMarketplacePage() {
  let templates: PageTemplate[] = [];
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${base}/api/sop-marketplace?limit=100`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      templates = (json.templates as PageTemplate[]) ?? [];
    }
  } catch {
    templates = [];
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">SOP Marketplace</h1>
        <p className="mt-2 text-muted-foreground">
          Verified SOP templates to automate your agency workflows.
          Install in one click.
        </p>
      </div>

      <MarketplaceClient initialTemplates={templates as any} categories={CATEGORIES} />
    </div>
  );
}
