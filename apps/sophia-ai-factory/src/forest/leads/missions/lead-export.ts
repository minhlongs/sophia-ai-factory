/**
 * Handler: lead:export
 *
 * BYOK-aware bulk lead export via Apollo.io → CSV.
 * Falls back to a 5-row stub when no Apollo key is configured.
 *
 * Params:
 *   - niche: string       (required when BYOK live; default "technology" for stub)
 *   - max_rows: number    (default 100, hard-cap 500)
 *   - format: 'csv'       (only supported format in v1)
 */

import { z } from 'zod';
import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { apolloPeopleBulkSearch } from '@/tree/apollo/apollo-client';
import { logger } from '@/seed/utils/logger-utility';
import type { MissionHandlerResult, MissionContext } from '@/forest/missions/types';
import {
  STUB_ROWS,
  personsToCsv,
  stubCsv,
  isoDate,
  friendlyError,
} from './lead-export-csv';

const ExportParamsSchema = z.object({
  niche: z.string().min(2).max(120).default('technology'),
  max_rows: z.coerce.number().int().min(1).max(500).default(100),
  format: z.literal('csv').default('csv'),
});

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const parsed = ExportParamsSchema.safeParse(ctx.params ?? {});
  if (!parsed.success) {
    return { ok: false, error: 'validation_error', data: { message: parsed.error.message } };
  }
  const { niche, max_rows, format } = parsed.data;

  const apiKey = await resolveUserApiKey(ctx.userId, 'apollo');

  if (!apiKey) {
    const csv = stubCsv();
    return {
      ok: true,
      data: {
        format,
        content: csv,
        row_count: STUB_ROWS.length - 1,
        filename: 'leads-export-stub.csv',
        is_stub: true,
        upgrade_path: 'Add an Apollo.io API key in Settings > BYOK to export real leads',
      },
    };
  }

  try {
    const people = await apolloPeopleBulkSearch(apiKey, { niche, maxRows: max_rows });
    const csv = personsToCsv(people);
    const tenantShort = ctx.userId.slice(0, 8);
    const filename = `leads-export-${tenantShort}-${isoDate()}.csv`;
    return {
      ok: true,
      data: {
        format,
        content: csv,
        row_count: people.length,
        filename,
        is_stub: false,
      },
    };
  } catch (err) {
    logger.warn('[lead:export] Apollo bulk search failed', {
      code: (err as { code?: string }).code,
    });
    return { ok: false, error: 'apollo_error', data: { message: friendlyError(err) } };
  }
}
