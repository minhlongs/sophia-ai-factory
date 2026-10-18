/**
 * Handler: lead:find
 *
 * BYOK-aware lead search via Apollo.io People Search.
 *
 * When the caller has an Apollo BYOK key stored, this handler proxies
 * `POST /api/v1/mixed_people/search`. Otherwise it returns a curated stub
 * (preserves UI flow and lets non-paying explorers see realistic shape).
 *
 * Params:
 *   - niche?: string       → mapped to q_keywords
 *   - titles?: string[]    → mapped to person_titles
 *   - industries?: string[] → mapped to industry
 *   - count?: number       → mapped to per_page (clamped to 100 by client)
 *   - page?: number        → defaults 1
 */

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { apolloPeopleSearch } from '@/tree/apollo/apollo-client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from '@/forest/missions/types';
import {
  STUB_DELAY_MS,
  normaliseApolloPerson,
  buildStubLeads,
} from './lead-find-helpers';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const niche = (ctx.params?.niche as string) ?? 'digital marketing';
  const count = Math.min(Number(ctx.params?.count ?? 50), 100);
  const titles = Array.isArray(ctx.params?.titles)
    ? (ctx.params.titles as unknown[]).filter((t): t is string => typeof t === 'string')
    : undefined;
  const industries = Array.isArray(ctx.params?.industries)
    ? (ctx.params.industries as unknown[]).filter((t): t is string => typeof t === 'string')
    : undefined;
  const page = Number(ctx.params?.page ?? 1) || 1;

  const apiKey = await resolveUserApiKey(ctx.userId, 'apollo');

  if (!apiKey) {
    await new Promise((res) => setTimeout(res, STUB_DELAY_MS));
    const leads = buildStubLeads(niche, count);
    return {
      ok: true,
      data: {
        leads,
        total: leads.length,
        niche,
        is_stub: true,
        stub_reason: 'no_byok_key',
        upgrade_path: 'Add an Apollo.io API key in Settings > BYOK to fetch real prospects',
      },
    };
  }

  try {
    const response = await apolloPeopleSearch(apiKey, {
      q_keywords: niche,
      person_titles: titles,
      industry: industries,
      page,
      per_page: count,
    });
    const leads = response.people.map(normaliseApolloPerson);
    return {
      ok: true,
      data: {
        leads,
        total: leads.length,
        niche,
        is_stub: false,
        pagination: {
          page: response.pagination.page,
          per_page: response.pagination.per_page,
          total_entries: response.pagination.total_entries,
          total_pages: response.pagination.total_pages,
        },
      },
    };
  } catch (err) {
    const code = (err as { code?: string }).code ?? 'apollo_error';
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('[lead:find] Apollo call failed', { code, message });
    return { ok: false, error: code, data: { message } };
  }
}
