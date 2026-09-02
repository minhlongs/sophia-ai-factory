/**
 * Tests for POST/GET /api/support/tickets
 *
 * - Auth: 401 without session, 201/200 with session
 * - Validation: 400 for missing/short description, invalid priority
 * - POST: creates ticket with correct fields
 * - GET: lists user's tickets, supports status filter
 */

import { describe, it, expect } from 'vitest';
import {
  makeReq,
  mockGetCurrentUser,
  setChainResult,
  throwOnNextAwait,
  POST,
  GET,
} from './helpers';
import { NextRequest } from 'next/server';
// POST /api/support/tickets
describe('POST /api/support/tickets', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', {
        description: 'This is a valid ticket description with enough length',
      }),
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 400 when description is missing', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', { title: 'Test' }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe('Invalid ticket data');
  });

  it('returns 400 when description is too short (<10 chars)', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', { description: 'short' }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe('Invalid ticket data');
  });

  it('returns 400 when priority is invalid', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', {
        description: 'Valid description here',
        priority: 'invalid_priority',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; details?: unknown };
    expect(body.error).toBe('Invalid ticket data');
  });

  it('creates ticket and returns 201 with ticket object', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', {
        title: 'My Issue',
        description: 'This is a detailed description of my issue',
        priority: 'high',
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      ticket: { title: string | null; message: string; status: string; priority: string };
    };
    expect(body.ticket).toBeDefined();
    expect(body.ticket.title).toBe('My Issue');
    expect(body.ticket.message).toBe('This is a detailed description of my issue');
    expect(body.ticket.status).toBe('open');
    expect(body.ticket.priority).toBe('high');
  });

  it('creates ticket with default priority when not specified', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', {
        description: 'Description without priority field',
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ticket: { priority: string } };
    expect(body.ticket.priority).toBe('normal');
  });

  it('creates ticket with optional title', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', {
        description: 'Description only, no title',
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { ticket: { title: string | null } };
    expect(body.ticket.title).toBeNull();
  });

  it('returns 500 when DB insert throws', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    throwOnNextAwait(true);
    const res = await POST(
      makeReq('POST', 'http://localhost/api/support/tickets', {
        description: 'This description is long enough to pass validation',
      }),
    );
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Failed to create support ticket');
  });
});

// GET /api/support/tickets
describe('GET /api/support/tickets', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);
    const res = await GET(new NextRequest('http://localhost/api/support/tickets'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Unauthorized');
  });

  it('returns 400 when status filter is invalid', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    const res = await GET(
      new NextRequest('http://localhost/api/support/tickets?status=invalid_status'),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; validValues: string[] };
    expect(body.error).toBe('Invalid status filter');
    expect(body.validValues).toEqual(['open', 'in_progress', 'resolved', 'closed']);
  });

  it('returns tickets for authenticated user', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    setChainResult(
      [
        { id: 1, user_id: 'user1', source: 'web', title: 'Ticket 1', message: 'Desc 1', status: 'open', priority: 'normal', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 2, user_id: 'user1', source: 'web', title: 'Ticket 2', message: 'Desc 2', status: 'resolved', priority: 'high', created_at: '2026-01-02T00:00:00.000Z' },
      ],
      null,
    );
    const res = await GET(new NextRequest('http://localhost/api/support/tickets'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tickets: Array<{ title: string; status: string }> };
    expect(body.tickets).toHaveLength(2);
    expect(body.tickets[0].title).toBe('Ticket 1');
    expect(body.tickets[1].status).toBe('resolved');
  });

  it('filters tickets by status', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    setChainResult(
      [
        { id: 1, user_id: 'user1', source: 'web', title: 'Open Ticket', message: 'Desc', status: 'open', priority: 'normal', created_at: '2026-01-01T00:00:00.000Z' },
      ],
      null,
    );
    const res = await GET(
      new NextRequest('http://localhost/api/support/tickets?status=open'),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tickets: Array<{ status: string }> };
    expect(body.tickets).toHaveLength(1);
    expect(body.tickets[0].status).toBe('open');
  });

  it('returns empty array when user has no tickets', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    setChainResult([], null);
    const res = await GET(new NextRequest('http://localhost/api/support/tickets'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tickets: unknown[] };
    expect(body.tickets).toEqual([]);
  });

  it('returns 500 when DB query returns error', async () => {
    mockGetCurrentUser.mockResolvedValueOnce({ id: 'user1', email: 'user@test.com' });
    setChainResult(null, { message: 'DB error' });
    const res = await GET(new NextRequest('http://localhost/api/support/tickets'));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Failed to list support tickets');
  });
});

