/**
 * Apollo.io API v1 Types & HTTP Error Helpers
 *
 * Layer: tree/apollo
 */

import { logger } from '@/seed/utils/logger-utility';

export const APOLLO_BASE = 'https://api.apollo.io';
export const SEARCH_PATH = '/api/v1/mixed_people/search';
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export interface ApolloSearchRequest {
  /** Free-text query — e.g. "marketing", or niche keyword */
  q_keywords?: string;
  /** Job titles to include (OR semantics) */
  person_titles?: string[];
  /** Industries to include */
  industry?: string[];
  /** Page number (1-indexed). Apollo allows up to 500 pages. */
  page?: number;
  /** Rows per page. Apollo max is 100. */
  per_page?: number;
}

export interface ApolloPerson {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  organization: {
    id: string;
    name: string;
    primary_domain: string | null;
    industry: string | null;
  } | null;
}

export interface ApolloSearchResponse {
  people: ApolloPerson[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

export interface ApolloErrorResponse extends Error {
  code: string;
  status: number;
}

/** Request shape for bulk/paginated export. */
export interface ApolloBulkSearchRequest {
  /** Industry niche keyword — mapped to q_organization_industries. */
  niche: string;
  /** Maximum rows to return across all pages. Hard-capped at 500 by caller. */
  maxRows: number;
}

export function clampPageSize(per_page: number | undefined): number {
  const n = per_page ?? DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(n, MAX_PAGE_SIZE));
}

export async function throwApolloHttpError(
  res: Response,
  context: string,
): Promise<never> {
  let text = '';
  try {
    text = await res.text();
  } catch (err) {
    logger.warn('Failed to read Apollo response body', undefined, {
      error: String(err),
      context,
    });
  }
  const err: ApolloErrorResponse = Object.assign(
    new Error(`Apollo HTTP ${res.status}`),
    {
      code: `apollo_${res.status}`,
      status: res.status,
      message: text.slice(0, 500) || `Apollo HTTP ${res.status}`,
    },
  );
  throw err;
}
