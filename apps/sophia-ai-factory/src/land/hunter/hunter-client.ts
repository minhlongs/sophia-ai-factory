/**
 * Hunter.io API v2 client (BYOK).
 *
 * Wraps two endpoints used by `lead:enrich` mission handler:
 *   - GET /v2/email-finder?domain=<>&first_name=<>&last_name=<> → find an email
 *   - GET /v2/email-verifier?email=<> → score deliverability
 *
 * Auth via `?api_key=` query string (Hunter convention).
 * Docs: https://hunter.io/api-documentation/v2.
 */

import { logger } from '@/seed/utils/logger-utility';

const HUNTER_BASE = 'https://api.hunter.io/v2';

export interface HunterEmailFinderRequest {
  domain: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
}

export interface HunterEmailFinderResponse {
  data: {
    email: string | null;
    score: number | null;
    domain: string;
    first_name: string | null;
    last_name: string | null;
    position: string | null;
    twitter: string | null;
    linkedin_url: string | null;
    phone_number: string | null;
    company: string | null;
    sources: Array<{ domain: string; uri: string }>;
  };
  meta: { params: Record<string, unknown> };
}

export interface HunterEmailVerifierResponse {
  data: {
    status: 'valid' | 'invalid' | 'accept_all' | 'webmail' | 'disposable' | 'unknown';
    result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown';
    score: number;
    email: string;
    regexp: boolean;
    gibberish: boolean;
    disposable: boolean;
    webmail: boolean;
    mx_records: boolean;
    smtp_server: boolean;
    smtp_check: boolean;
  };
}

export interface HunterErrorResponse extends Error {
  code: string;
  status: number;
}

function buildUrl(path: string, params: Record<string, string | undefined>, apiKey: string): string {
  const url = new URL(`${HUNTER_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  });
  url.searchParams.set('api_key', apiKey);
  return url.toString();
}

async function callHunter<T>(path: string, params: Record<string, string | undefined>, apiKey: string): Promise<T> {
  const res = await fetch(buildUrl(path, params, apiKey), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch((err) => {
      logger.warn('Failed to read Hunter response', { error: String(err), context: 'callHunter' });
      return '';
    });
    const err: HunterErrorResponse = Object.assign(new Error(`Hunter HTTP ${res.status}`), {
      code: `hunter_${res.status}`,
      status: res.status,
      message: text.slice(0, 500) || `Hunter HTTP ${res.status}`,
    });
    throw err;
  }

  return res.json() as Promise<T>;
}

export function findEmail(apiKey: string, req: HunterEmailFinderRequest): Promise<HunterEmailFinderResponse> {
  return callHunter<HunterEmailFinderResponse>('/email-finder', {
    domain: req.domain,
    first_name: req.first_name,
    last_name: req.last_name,
    full_name: req.full_name,
  }, apiKey);
}

export function verifyEmail(apiKey: string, email: string): Promise<HunterEmailVerifierResponse> {
  return callHunter<HunterEmailVerifierResponse>('/email-verifier', { email }, apiKey);
}
