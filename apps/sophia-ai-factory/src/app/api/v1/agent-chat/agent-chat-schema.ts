/**
 * Zod schemas for the agent-chat API request validation.
 * @module app/api/v1/agent-chat/agent-chat-schema
 */

import { z } from 'zod';

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1).max(8000),
});

export const BodySchema = z.object({
  messages: z.array(ChatMessageSchema).min(1).max(100),
  context: z
    .object({
      currentPage: z.string().optional(),
      installationId: z.string().optional(),
      locale: z.string().optional(),
    })
    .optional(),
});
