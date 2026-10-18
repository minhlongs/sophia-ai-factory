/**
 * Analytics - Violation / Security Event Queries
 *
 * Fetches violation events with pagination and builds summary statistics.
 */

import { createServerClient } from '@/seed/db/client';
import { logger } from '@/seed/utils/logger-utility';
import { toError } from '@/seed/utils/to-error';
import type { ViolationFilters, ViolationEvent, ViolationSummary } from '../types';
import {
  aggregateViolationSummary,
  applyViolationFilters,
  mapViolationRowToEvent,
  type ViolationRow,
} from './violation-query-helpers';

/**
 * Fetch violation events from Supabase/D1 with pagination
 *
 * @param filters - Query filters for violation data
 * @param page - Page number (default: 1)
 * @param limit - Items per page (default: 50, max: 100)
 */
export async function fetchViolations(
  filters: ViolationFilters = {},
  page: number = 1,
  limit: number = 50
): Promise<{ violations: ViolationEvent[]; total: number; hasMore: boolean }> {
  const db = createServerClient();

  let query = db.from('violations').select('*', { count: 'exact' });
  query = applyViolationFilters(query, filters);

  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1).order('created_at', { ascending: false });

  const { data: rawViolations, error, count } = await query;

  if (error) {
    logger.error('[Analytics] Failed to fetch violations', toError(error));
    throw new Error('Failed to fetch violations');
  }

  const violations = rawViolations as ViolationRow[] | null;
  if (!violations || violations.length === 0) {
    return { violations: [], total: 0, hasMore: false };
  }

  const typedViolations = violations.map(mapViolationRowToEvent);
  const total = count || violations.length;
  return { violations: typedViolations, total, hasMore: from + violations.length < total };
}

/**
 * Fetch violation summary statistics
 *
 * @param filters - Query filters for violation data
 * @param startTimestamp - Start timestamp for trend data
 * @param endTimestamp - End timestamp for trend data
 */
export async function fetchViolationSummary(
  filters: ViolationFilters = {},
  startTimestamp: number,
  endTimestamp: number
): Promise<ViolationSummary> {
  const db = createServerClient();

  let query = db.from('violations').select('*');
  query = applyViolationFilters(query, filters);
  query = query.gte('created_at', startTimestamp).lte('created_at', endTimestamp);

  const { data: rawViolations, error } = await query;

  if (error) {
    logger.error('[Analytics] Failed to fetch violation summary', toError(error));
    throw new Error('Failed to fetch violation summary');
  }

  return aggregateViolationSummary(rawViolations as ViolationRow[] | null);
}
