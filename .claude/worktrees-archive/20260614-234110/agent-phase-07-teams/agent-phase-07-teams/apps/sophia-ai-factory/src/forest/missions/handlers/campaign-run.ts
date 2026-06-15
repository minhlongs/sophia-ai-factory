/**
 * Handler: campaign:run
 *
 * Orchestrates a full pipeline: lead:find → email:campaign.
 * LIVE — coordinates existing handlers.
 */

import { handle as findLeads } from './lead-find';
import { handle as runEmailCampaign } from './email-campaign';
import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const { params } = ctx;
  const niche = (params?.niche as string) ?? 'digital marketing';
  const subject = (params?.subject as string) ?? 'Special offer for you';
  const body = (params?.body as string) ?? '<p>Hello! We have an exclusive offer for you.</p>';
  const leadCount = Math.min(Number(params?.lead_count ?? 10), 50);

  // Step 1: Find leads
  const leadsResult = await findLeads({
    ...ctx,
    command: 'lead:find',
    params: { niche, count: leadCount },
  });

  if (!leadsResult.ok) {
    return { ok: false, error: `Lead find failed: ${leadsResult.error}` };
  }

  const leads = (leadsResult.data?.leads as Array<{ email: string }>) ?? [];
  const recipients = leads.map(l => l.email);

  // Step 2: Send email campaign
  const emailResult = await runEmailCampaign({
    ...ctx,
    command: 'email:campaign',
    params: { recipients, subject, body },
  });

  return {
    ok: emailResult.ok,
    data: {
      pipeline: 'lead:find → email:campaign',
      leads_found: leads.length,
      emails_sent: (emailResult.data?.sent as number) ?? 0,
      emails_failed: (emailResult.data?.failed as number) ?? 0,
      niche,
      is_stub: leadsResult.data?.is_stub ?? false,
    },
    error: emailResult.error,
  };
}
