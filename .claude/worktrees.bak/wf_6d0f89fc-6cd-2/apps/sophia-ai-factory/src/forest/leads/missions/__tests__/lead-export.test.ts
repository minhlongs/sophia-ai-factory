/**
 * Tests for lead:export handler — Apollo bulk CSV export (BYOK; stub fallback).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/tree/byok/resolve-user-api-key', () => ({
  resolveUserApiKey: vi.fn(),
}));
vi.mock('@/tree/apollo/apollo-client', () => ({
  apolloPeopleBulkSearch: vi.fn(),
}));
vi.mock('@/seed/utils/logger-utility', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { resolveUserApiKey } from '@/tree/byok/resolve-user-api-key';
import { apolloPeopleBulkSearch } from '@/tree/apollo/apollo-client';
import { handle } from '../lead-export';
import type { ApolloPerson } from '@/tree/apollo/apollo-client';

const mockResolve = resolveUserApiKey as ReturnType<typeof vi.fn>;
const mockBulk = apolloPeopleBulkSearch as ReturnType<typeof vi.fn>;

const baseCtx = {
  missionId: 'm-1',
  userId: 'user-abcd1234',
  command: 'lead:export',
  params: { niche: 'SaaS', max_rows: 10, format: 'csv' },
};

function makePerson(i: number): ApolloPerson {
  return {
    id: `pid-${i}`,
    name: `Person ${i}`,
    first_name: `Person`,
    last_name: `${i}`,
    title: `Title ${i}`,
    email: `person${i}@company${i}.io`,
    linkedin_url: `https://linkedin.com/in/person${i}`,
    organization: {
      id: `org-${i}`,
      name: `Company ${i}`,
      primary_domain: `company${i}.io`,
      industry: 'SaaS',
    },
  };
}

describe('lead:export handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // T-01: no BYOK key → stub fallback
  it('returns stub with is_stub=true and 5 data rows when no Apollo key', async () => {
    mockResolve.mockResolvedValueOnce(null);
    const result = await handle(baseCtx);
    expect(result.ok).toBe(true);
    expect(result.data?.is_stub).toBe(true);
    expect(result.data?.row_count).toBe(5);
    expect(result.data?.upgrade_path).toMatch(/Apollo/i);
    // CSV has header + 5 data rows = 6 lines
    const lines = (result.data?.content as string).split('\n');
    expect(lines[0]).toBe('Name,Email,Company,Title,Domain,LinkedIn');
    expect(lines).toHaveLength(6);
    expect(mockBulk).not.toHaveBeenCalled();
  });

  // T-02: BYOK happy path — 100 people returned, correct CSV shape
  it('returns real CSV with 100 data rows + is_stub=false when Apollo key present', async () => {
    mockResolve.mockResolvedValueOnce('apollo-key-xyz');
    const people = Array.from({ length: 100 }, (_, i) => makePerson(i));
    mockBulk.mockResolvedValueOnce(people);
    const result = await handle(baseCtx);
    expect(result.ok).toBe(true);
    expect(result.data?.is_stub).toBe(false);
    expect(result.data?.row_count).toBe(100);
    const lines = (result.data?.content as string).split('\n');
    expect(lines[0]).toBe('Name,Email,Company,Title,Domain,LinkedIn');
    expect(lines).toHaveLength(101); // header + 100
    expect(mockBulk).toHaveBeenCalledWith('apollo-key-xyz', { niche: 'SaaS', maxRows: 10 });
  });

  // T-03: max_rows > 500 → Zod validation error (coerced to int, max=500)
  it('returns validation_error when max_rows exceeds 500', async () => {
    mockResolve.mockResolvedValueOnce('apollo-key-xyz');
    const result = await handle({ ...baseCtx, params: { niche: 'SaaS', max_rows: 501 } });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('validation_error');
    expect(mockBulk).not.toHaveBeenCalled();
  });

  // T-04: pagination boundary — max_rows=250, Apollo returns 3 pages (100+100+50)
  it('aggregates pages and returns 250 rows when paginated', async () => {
    mockResolve.mockResolvedValueOnce('apollo-key-xyz');
    // apolloPeopleBulkSearch handles pagination internally; mock returns 250 people
    const people = Array.from({ length: 250 }, (_, i) => makePerson(i));
    mockBulk.mockResolvedValueOnce(people);
    const ctx = { ...baseCtx, params: { niche: 'tech', max_rows: 250 } };
    const result = await handle(ctx);
    expect(result.ok).toBe(true);
    expect(result.data?.row_count).toBe(250);
    expect(mockBulk).toHaveBeenCalledWith('apollo-key-xyz', { niche: 'tech', maxRows: 250 });
  });

  // T-05: Apollo 401 → friendly error message
  it('returns apollo_error with friendly message on Apollo 401', async () => {
    mockResolve.mockResolvedValueOnce('bad-key');
    mockBulk.mockRejectedValueOnce({ status: 401, code: 'apollo_401', message: 'Unauthorized' });
    const result = await handle(baseCtx);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('apollo_error');
    expect((result.data?.message as string).toLowerCase()).toMatch(/invalid apollo api key/i);
  });

  // T-06: CSV escape — field with comma and double-quote properly escaped
  it('properly RFC-4180 escapes fields containing commas and quotes', async () => {
    mockResolve.mockResolvedValueOnce('apollo-key-xyz');
    const tricky = makePerson(0);
    tricky.name = 'O\'Brien, Inc., "CEO"';
    tricky.organization!.name = 'Comma, Corp';
    mockBulk.mockResolvedValueOnce([tricky]);
    const result = await handle({ ...baseCtx, params: { niche: 'SaaS', max_rows: 1 } });
    expect(result.ok).toBe(true);
    const csv = result.data?.content as string;
    // Company "Comma, Corp" must be wrapped in quotes
    expect(csv).toContain('"Comma, Corp"');
    // Name with embedded quotes: inner quote escaped as ""
    expect(csv).toContain('"O\'Brien, Inc., ""CEO"""');
  });

  // T-07: Apollo 429 → rate-limit friendly message
  it('returns rate-limit message on Apollo 429', async () => {
    mockResolve.mockResolvedValueOnce('apollo-key-xyz');
    mockBulk.mockRejectedValueOnce({ status: 429, code: 'apollo_429', message: 'Rate limited' });
    const result = await handle(baseCtx);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('apollo_error');
    expect((result.data?.message as string).toLowerCase()).toMatch(/rate-limited/i);
  });
});
