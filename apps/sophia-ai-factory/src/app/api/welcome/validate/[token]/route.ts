/**
 * GET /api/welcome/validate/[token]
 * Validates magic link token and returns handover data for welcome page.
 * POST: consumes token (marks first login, invalidates token) + creates Better Auth session.
 */

export const dynamic = 'force-dynamic';
export { GET, POST } from './core';
