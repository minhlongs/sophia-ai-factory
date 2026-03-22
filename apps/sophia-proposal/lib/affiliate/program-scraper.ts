/**
 * Affiliate program scraper
 *
 * Sources:
 * 1. PartnerStack public directory API
 * 2. Manual seed list (SEED_PROGRAMS)
 *
 * Pipeline: fetch → normalize → score → upsert into affiliate_programs
 */

import { getD1Client } from '@/lib/db/client';
import { scoreProgram } from './program-scorer';
import { SEED_PROGRAMS } from './seed-programs';
import type { RawProgram, ScrapeResult, AffiliateProgramInput, AffiliateProgram } from '@/types/affiliate';

const PARTNERSTACK_API = 'https://api.partnerstack.com/api/v2/partnerships';
const SCRAPE_DELAY_MS = 2000; // 1 req/2s to respect rate limits

/** Fetch programs from PartnerStack public directory */
async function fetchPartnerStack(): Promise<RawProgram[]> {
  try {
    const res = await fetch(PARTNERSTACK_API, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) return [];

    await new Promise((r) => setTimeout(r, SCRAPE_DELAY_MS));

    const json = await res.json();
    const items: unknown[] = Array.isArray(json?.data) ? json.data : [];

    return items
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item) => ({
        name: String(item.name ?? ''),
        company: String(item.company ?? item.name ?? ''),
        url: String(item.url ?? item.website ?? ''),
        signup_url: item.signup_url ? String(item.signup_url) : undefined,
        commission_rate: Number(item.commission_rate ?? item.commission ?? 10),
        commission_type: 'recurring' as const,
        cookie_duration_days: Number(item.cookie_duration ?? 30),
        payout_threshold: Number(item.payout_threshold ?? 50),
        payout_frequency: String(item.payout_frequency ?? 'monthly'),
        niche: 'saas' as const,
        description: item.description ? String(item.description) : undefined,
        source: 'partnerstack' as const,
        external_id: item.id ? String(item.id) : undefined,
        metadata: { raw: item },
      }))
      .filter((p) => p.name && p.url);
  } catch {
    // PartnerStack API unavailable — fallback to seed only
    return [];
  }
}

/** Map SEED_PROGRAMS to RawProgram (they already conform) */
function fetchManualSeed(): RawProgram[] {
  return SEED_PROGRAMS;
}

/** Normalize RawProgram → AffiliateProgramInput with computed score */
function normalize(raw: RawProgram): AffiliateProgramInput {
  return {
    name: raw.name,
    company: raw.company,
    url: raw.url,
    signup_url: raw.signup_url ?? null,
    commission_rate: raw.commission_rate,
    commission_type: raw.commission_type,
    cookie_duration_days: raw.cookie_duration_days,
    payout_threshold: raw.payout_threshold,
    payout_frequency: raw.payout_frequency,
    niche: raw.niche,
    description: raw.description ?? null,
    logo_url: raw.logo_url ?? null,
    is_active: true,
    source: raw.source,
    external_id: raw.external_id ?? null,
    metadata: raw.metadata ?? {},
    last_scraped_at: new Date().toISOString(),
  };
}

/**
 * Run full scrape → score → upsert pipeline.
 * Returns ScrapeResult with counts and top programs.
 */
export async function runScrape(): Promise<ScrapeResult> {
  const errors: string[] = [];

  // Gather from all sources
  const [partnerStackPrograms, seedPrograms] = await Promise.all([
    fetchPartnerStack().catch((e) => {
      errors.push(`PartnerStack fetch failed: ${String(e)}`);
      return [] as RawProgram[];
    }),
    Promise.resolve(fetchManualSeed()),
  ]);

  // Deduplicate by name (seed takes precedence over scraped)
  const seen = new Set<string>();
  const combined: RawProgram[] = [];

  for (const p of [...seedPrograms, ...partnerStackPrograms]) {
    const key = p.name.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(p);
    }
  }

  // Score + normalize
  const records = combined.map((raw) => {
    const score = scoreProgram(raw);
    return { ...normalize(raw), score };
  });

  // Upsert into D1 (conflict on name + source)
  const db = await getD1Client();
  let inserted = 0;
  let updated = 0;

  for (const record of records) {
    const { data: existing } = await db
      .from<{ id: string }>('affiliate_programs')
      .select('id')
      .eq('name', record.name)
      .eq('source', record.source)
      .maybeSingle();

    if (existing) {
      await db
        .from('affiliate_programs')
        .update({ ...record, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      updated++;
    } else {
      await db.from('affiliate_programs').insert(record);
      inserted++;
    }
  }

  // Fetch top programs after upsert
  const { data: topPrograms } = await db
    .from<AffiliateProgram>('affiliate_programs')
    .select('*')
    .gte('score', 60)
    .eq('is_active', true)
    .order('score', { ascending: false })
    .limit(10);

  return {
    inserted,
    updated,
    top_programs: (topPrograms as AffiliateProgram[]) ?? [],
    errors,
  };
}
