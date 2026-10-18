/**
 * Apollo.io API v1 client (BYOK).
 *
 * Wraps POST /api/v1/mixed_people/search — the canonical people-search endpoint.
 * Authentication: `X-Api-Key` header (Apollo.io master key model).
 *
 * Surface kept minimal — only the fields used by `lead:find` mission handler.
 * Documented at https://docs.apollo.io/reference/people-search.
 */

import {
  APOLLO_BASE,
  SEARCH_PATH,
  MAX_PAGE_SIZE,
  clampPageSize,
  throwApolloHttpError,
  type ApolloSearchRequest,
  type ApolloPerson,
  type ApolloSearchResponse,
  type ApolloErrorResponse,
  type ApolloBulkSearchRequest,
} from './apollo-types';

export type {
  ApolloSearchRequest,
  ApolloPerson,
  ApolloSearchResponse,
  ApolloErrorResponse,
  ApolloBulkSearchRequest,
};

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
    await throwApolloHttpError(res, 'apolloPeopleSearch');
  }

  return res.json() as Promise<ApolloSearchResponse>;
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
      await throwApolloHttpError(res, 'apolloPeopleBulkSearch');
    }

    const json = (await res.json()) as { people?: ApolloPerson[] };
    const people = json.people ?? [];
    out.push(...people);

    if (people.length < perPage) break; // last page reached
    if (out.length >= req.maxRows) break; // cap reached
  }

  return out.slice(0, req.maxRows);
}
