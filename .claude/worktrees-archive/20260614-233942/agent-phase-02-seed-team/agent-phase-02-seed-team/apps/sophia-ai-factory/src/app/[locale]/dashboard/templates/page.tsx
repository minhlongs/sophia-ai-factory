/**
 * Template Selector — /dashboard/templates
 *
 * Server Component listing video template presets accessible to the caller's tier.
 * Optional `?category=educational|marketing|social|brand` narrows the catalog.
 *
 * Data source: `listTemplatesForTier` from `@/seed/templates/presets` (same registry
 * the public GET /api/video-templates endpoint serves; avoids an HTTP round trip).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import {
  listTemplatesForTier,
  type TemplatePreset,
  type TemplateCategory,
} from '@/seed/templates/presets';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ category?: string }>;

const VALID_CATEGORIES: ReadonlyArray<TemplateCategory> = [
  'educational', 'marketing', 'social', 'brand',
];

const TIER_BADGE: Record<TemplatePreset['minTier'], string> = {
  BASIC: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PREMIUM: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  ENTERPRISE: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  MASTER: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  educational: 'Educational',
  marketing: 'Marketing',
  social: 'Social',
  brand: 'Brand',
};

export default async function TemplatesPage(props: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const tierRaw = await resolveUserTier(user.id);
  const tier = (typeof tierRaw === 'string' ? tierRaw.toUpperCase() : 'BASIC') as
    | 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

  const { category } = await props.searchParams;
  const activeCategory = category && VALID_CATEGORIES.includes(category as TemplateCategory)
    ? (category as TemplateCategory)
    : null;

  const allForTier = listTemplatesForTier(tier);
  const presets = activeCategory
    ? allForTier.filter((p) => p.category === activeCategory)
    : allForTier;

  const categoryCounts = allForTier.reduce<Record<string, number>>((acc, p) => {
    acc[p.category] = (acc[p.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Template Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {presets.length} template{presets.length === 1 ? '' : 's'} available on the {tier} tier.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by category">
        <FilterChip
          href="/dashboard/templates"
          label={`All (${allForTier.length})`}
          active={!activeCategory}
        />
        {VALID_CATEGORIES.map((cat) => (
          <FilterChip
            key={cat}
            href={`/dashboard/templates?category=${cat}`}
            label={`${CATEGORY_LABEL[cat]} (${categoryCounts[cat] ?? 0})`}
            active={activeCategory === cat}
          />
        ))}
      </nav>

      {presets.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No templates match this filter on your tier.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <TemplateCard key={preset.id} preset={preset} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active
          ? 'border-[var(--neon-cyan)] bg-[var(--neon-cyan)]/15 text-[var(--neon-cyan)]'
          : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  );
}

function TemplateCard({ preset }: { preset: TemplatePreset }): React.JSX.Element {
  return (
    <article className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold truncate">{preset.displayName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {preset.aspectRatio} · {preset.durationSec}s · {preset.vibe}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${TIER_BADGE[preset.minTier]}`}
        >
          {preset.minTier}
        </span>
      </header>

      <video
        controls
        preload="none"
        className="w-full rounded bg-black/40 aspect-video"
        aria-label={`${preset.displayName} preview`}
      >
        <source src={preset.samplePath} type="video/mp4" />
        Your browser does not support inline video playback.
      </video>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <code className="font-mono text-muted-foreground truncate" title={preset.id}>
          {preset.id}
        </code>
        <span className="rounded bg-muted/40 px-1.5 py-0.5 uppercase tracking-wide text-muted-foreground">
          {CATEGORY_LABEL[preset.category]}
        </span>
      </div>
    </article>
  );
}
