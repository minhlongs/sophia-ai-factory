/**
 * Support Tickets Route Helpers
 *
 * Validation schemas and database helpers for /api/support/tickets.
 */

import { z } from 'zod';
import { createServerClient } from '@/seed/db/client';

export const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const VALID_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;

export const createTicketSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(10).max(5000),
  priority: z.enum(VALID_PRIORITIES).default('normal'),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export function isValidTicketStatus(
  status: string,
): status is (typeof VALID_STATUSES)[number] {
  return VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]);
}

export async function insertSupportTicketRecord(
  userId: string,
  input: CreateTicketInput,
): Promise<{
  id: string;
  title: string | null;
  message: string;
  status: 'open';
  priority: (typeof VALID_PRIORITIES)[number];
}> {
  const db = createServerClient();
  const ticketId = crypto.randomUUID();
  const title = input.title ?? null;

  await db.from('support_tickets').insert({
    id: ticketId,
    user_id: userId,
    source: 'web',
    title,
    message: input.description,
    status: 'open',
    priority: input.priority,
    created_at: new Date().toISOString(),
  });

  return {
    id: ticketId,
    title,
    message: input.description,
    status: 'open',
    priority: input.priority,
  };
}

export async function fetchUserSupportTickets(
  userId: string,
  statusParam: string | null,
): Promise<{ data: Record<string, unknown>[] | null; error: unknown }> {
  const db = createServerClient();
  let query = db.from('support_tickets').select('*').eq('user_id', userId);
  if (statusParam) {
    query = query.eq('status', statusParam);
  }
  return await query;
}
