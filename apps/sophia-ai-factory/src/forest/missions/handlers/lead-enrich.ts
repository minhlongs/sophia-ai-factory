/**
 * Handler: lead:enrich
 *
 * STUB — returns enriched lead data with realistic mock fields.
 * Real implementation pending: wire to Hunter.io / Clearbit via setup-wizard integrations.
 */

import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const email = (ctx.params?.email as string) ?? '';

  await new Promise(res => setTimeout(res, 2000));

  if (!email) {
    return { ok: false, error: 'params.email is required' };
  }

  const domain = email.split('@')[1] ?? 'unknown.com';

  return {
    ok: true,
    data: {
      email,
      company: domain.split('.')[0] + ' Inc',
      domain,
      linkedin_url: `https://linkedin.com/in/stub-profile`,
      twitter_handle: '@stub_user',
      phone: '+1-555-000-0000',
      location: 'San Francisco, CA',
      employee_count: '11-50',
      industry: 'Software',
      technologies: ['React', 'Node.js', 'AWS'],
      confidence_score: 0,
      is_stub: true,
      upgrade_path: 'Connect Hunter.io or Clearbit in Settings > Integrations for real enrichment data',
    },
  };
}
