/**
 * Voice Selector — /dashboard/voices
 *
 * Server Component listing voice presets accessible to the caller's tier.
 * Optional `?lang=en|vi|es` narrows the catalog. Each card has an inline
 * <audio> sample player — Safari + Chrome handle WAV natively.
 *
 * Data source: `listPresetsForTier` from `@/seed/voices/presets` (same registry
 * the public GET /api/voice-presets endpoint serves; avoids an HTTP round trip).
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/seed/auth/better-auth-session';
import { resolveUserTier } from '@/seed/db/resolve-user-tier';
import { listPresetsForTier, type VoicePreset, type VoiceLanguage } from '@/seed/voices/presets';

export const dynamic = 'force-dynamic';

const VALID_LANGS: ReadonlyArray<VoiceLanguage> = ['en', 'vi', 'es', 'fr', 'de', 'pt', 'ja', 'zh'];

type SearchParams = Promise<{ lang?: string }>;

const TIER_BADGE: Record<VoicePreset['minTier'], string> = {
  BASIC: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  PREMIUM: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  ENTERPRISE: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  MASTER: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

export default async function VoicesPage(props: {
  searchParams: SearchParams;
}): Promise<React.JSX.Element> {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const tierRaw = await resolveUserTier(user.id);
  const tier = (typeof tierRaw === 'string' ? tierRaw.toUpperCase() : 'BASIC') as
    | 'BASIC' | 'PREMIUM' | 'ENTERPRISE' | 'MASTER';

  const { lang } = await props.searchParams;
  const filterLang = lang && VALID_LANGS.includes(lang as VoiceLanguage)
    ? (lang as VoiceLanguage)
    : null;

  const presets = listPresetsForTier(tier).filter(
    (p) => !filterLang || p.language === filterLang,
  );

  const langCounts = presets.reduce<Record<string, number>>((acc, p) => {
    acc[p.language] = (acc[p.language] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Voice Library</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {presets.length} voice preset{presets.length === 1 ? '' : 's'} available on the {tier} tier.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Filter by language">
        <FilterChip href="/dashboard/voices" label={`All (${listPresetsForTier(tier).length})`} active={!filterLang} />
        {Object.entries(langCounts).map(([code, n]) => (
          <FilterChip
            key={code}
            href={`/dashboard/voices?lang=${code}`}
            label={`${code.toUpperCase()} (${n})`}
            active={filterLang === code}
          />
        ))}
      </nav>

      {presets.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          No voice presets match this filter on your tier.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((preset) => (
            <VoiceCard key={preset.id} preset={preset} />
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

function VoiceCard({ preset }: { preset: VoicePreset }): React.JSX.Element {
  return (
    <article className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{preset.displayName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {preset.language.toUpperCase()} · {preset.gender} · {preset.vibe}
          </p>
        </div>
        <span
          className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${TIER_BADGE[preset.minTier]}`}
        >
          {preset.minTier}
        </span>
      </header>

      <audio controls preload="none" className="w-full" aria-label={`${preset.displayName} sample`}>
        <source src={preset.samplePath} type="audio/wav" />
        Your browser does not support inline audio playback.
      </audio>

      <code className="block text-[11px] font-mono text-muted-foreground truncate" title={preset.id}>
        {preset.id}
      </code>
    </article>
  );
}
