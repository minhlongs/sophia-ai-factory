/**
 * /api/support/tickets — Support Ticketing REST API
 *
 * POST — Create a new support ticket (auth required)
 * GET  — List the authenticated user's tickets (optional status filter)
 */

import { NextRequest } from 'next/server';
import { handleCreateTicket, handleListTickets } from './ticket-route-handler';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCreateTicket(request);
}

export async function GET(request: NextRequest) {
  return handleListTickets(request);
}