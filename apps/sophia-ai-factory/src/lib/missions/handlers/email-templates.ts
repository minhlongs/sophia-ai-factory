/**
 * Handler: email:templates
 *
 * Lists the user's saved email templates.
 * Templates are stored as JSON in user_provider_credentials with provider='email_templates'
 * OR returned as built-in defaults if none saved.
 * LIVE — no external API.
 */

import { createServerClient } from '@/lib/db/client';
import type { MissionHandlerResult, MissionContext } from './types';

const BUILT_IN_TEMPLATES = [
  {
    id: 'builtin-welcome',
    name: 'Welcome Email',
    subject: 'Welcome to {{company_name}}!',
    body: '<h1>Welcome!</h1><p>Thanks for joining us, {{first_name}}.</p>',
    category: 'onboarding',
  },
  {
    id: 'builtin-followup',
    name: 'Follow-Up',
    subject: 'Following up on our conversation',
    body: '<p>Hi {{first_name}},</p><p>I wanted to follow up on my previous message...</p>',
    category: 'sales',
  },
  {
    id: 'builtin-proposal',
    name: 'Proposal Follow-Up',
    subject: 'Your proposal is ready, {{first_name}}',
    body: '<p>Hi {{first_name}},</p><p>Please find your custom proposal attached.</p>',
    category: 'sales',
  },
];

interface TemplateRow {
  encrypted_value: string;
}

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { userId } = ctx;
  const db = createServerClient();

  const { data } = await db
    .from('user_provider_credentials')
    .select('encrypted_value')
    .eq('user_id', userId)
    .eq('provider', 'email_templates')
    .single() as { data: TemplateRow | null; error: unknown };

  let userTemplates: unknown[] = [];
  if (data?.encrypted_value) {
    try {
      userTemplates = JSON.parse(data.encrypted_value) as unknown[];
    } catch {
      userTemplates = [];
    }
  }

  const allTemplates = [...BUILT_IN_TEMPLATES, ...userTemplates];

  return {
    ok: true,
    data: {
      templates: allTemplates,
      total: allTemplates.length,
      user_templates: userTemplates.length,
      builtin_templates: BUILT_IN_TEMPLATES.length,
    },
  };
}
