/**
 * Apollo.io API v1 client (BYOK).
 *
 * Wraps POST /api/v1/mixed_people/search — the canonical people-search endpoint.
 * Authentication: `X-Api-Key` header (Apollo.io master key model).
 *
 * Surface kept minimal — only the fields used by `lead:find` mission handler.
 * Documented at https://docs.apollo.io/reference/people-search.
 */

import { shouldAllowRequest, recordSuccess, recordFailure } from '@/seed/security/circuit-breaker';
import { classifyError } from '@/seed/types/failure-kind';
import { logger } from '@/seed/utils/logger-utility';

const APOLLO_BASE = 'https://api.apollo.io';
const SEARCH_PATH = '/api/v1/mixed_people/search';
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

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

function clampPageSize(per_page: number | undefined): number {
  const n = per_page ?? DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(n, MAX_PAGE_SIZE));
}

/**
 * Execute a People Search call against Apollo.io.
 * Throws `ApolloErrorResponse` on non-2xx HTTP.
 */
export async function apolloPeopleSearch(
  apiKey: string,
  req: ApolloSearchRequest,
): Promise<ApolloSearchResponse> {
  const body = {
    q_keywords: req.q_keywords,
    person_titles: req.person_titles,
    industry: req.industry,
    page: req.page ?? 1,
    per_page: clampPageSize(req.per_page),
  };

  const res = await fetch(`${APOLLO_BASE}${SEARCH_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let text = '';
    try {
      text = await res.text();
    } catch (err) {
      logger.warn('Failed to read Apollo response body', undefined, { error: String(err), context: 'apolloPeopleSearch' });
    }
    const err: ApolloErrorResponse = Object.assign(new Error(`Apollo HTTP ${res.status}`), {
      code: `apollo_${res.status}`,
      status: res.status,
      message: text.slice(0, 500) || `Apollo HTTP ${res.status}`,
    });
    throw err;
  }

  return res.json() as Promise<ApolloSearchResponse>;
}

/** Request shape for bulk/paginated export. */
export interface ApolloBulkSearchRequest {
  /** Industry niche keyword — mapped to q_organization_industries. */
  niche: string;
  /** Maximum rows to return across all pages. Hard-capped at 500 by caller. */
  maxRows: number;
}

/**
 * Bulk-paginated Apollo people search.
 * Loops pages (100/page) until `maxRows` collected or Apollo page exhausted.
 * Throws `ApolloErrorResponse` on non-2xx HTTP.
 */
export async function apolloPeopleBulkSearch(
  apiKey: string,
  req: ApolloBulkSearchRequest,
): Promise<ApolloPerson[]> {
  const out: ApolloPerson[] = [];
  const perPage = MAX_PAGE_SIZE;
  const maxPages = Math.ceil(req.maxRows / perPage);

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(`${APOLLO_BASE}${SEARCH_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey,
      },
      body: JSON.stringify({
        q_organization_industries: [req.niche],
        page,
        per_page: perPage,
      }),
    });

    if (!res.ok) {
      let text = '';
      try {
        text = await res.text();
      } catch (err) {
        logger.warn('Failed to read Apollo response body', undefined, { error: String(err), context: 'apolloPeopleBulkSearch' });
      }
      const err: ApolloErrorResponse = Object.assign(new Error(`Apollo HTTP ${res.status}`), {
        code: `apollo_${res.status}`,
        status: res.status,
        message: text.slice(0, 500) || `Apollo HTTP ${res.status}`,
      });
      throw err;
    }

    const json = (await res.json()) as { people?: ApolloPerson[] };
    const people = json.people ?? [];
    out.push(...people);

    if (people.length < perPage) break; // last page reached
    if (out.length >= req.maxRows) break; // cap reached
  }

  return out.slice(0, req.maxRows);
}
