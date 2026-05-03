/**
 * Handler: lead:find
 *
 * STUB — returns 50 realistic-looking sample leads.
 * Real implementation pending: wire to Apollo.io or Hunter.io via setup-wizard integrations.
 */

import type { MissionHandlerResult, MissionContext } from './types';

const SAMPLE_COMPANIES = [
  'TechFlow Solutions', 'BrightMind Agency', 'NextGen Digital', 'Peak Performance Co',
  'CloudBase Systems', 'Luminary Labs', 'SwiftScale Inc', 'Horizon Marketing',
  'Catalyst Creative', 'Velocity Ventures', 'Apex Digital', 'Prism Analytics',
  'Nexus Media', 'Blueprint Agency', 'Momentum Growth', 'Elevate Digital',
  'Spark Solutions', 'Clarity Consulting', 'Pinnacle Media', 'Fusion Creative',
];

const SAMPLE_TITLES = [
  'CEO', 'Founder', 'CMO', 'Head of Marketing', 'VP Sales', 'Director of Growth',
  'Marketing Manager', 'Head of Business Development', 'Co-Founder', 'Growth Lead',
];

const SAMPLE_DOMAINS = [
  'techflow.io', 'brightmind.co', 'nextgendigital.com', 'peakperformance.io',
  'cloudbase.dev', 'luminarylabs.com', 'swiftscale.io', 'horizonmarketing.co',
  'catalystcreative.agency', 'velocityventures.io', 'apexdigital.co', 'prismanalytics.io',
  'nexusmedia.com', 'blueprintagency.co', 'momentumgrowth.io', 'elevatedigital.com',
  'sparksolutions.co', 'clarityconsulting.io', 'pinnaclemedia.co', 'fusioncreative.agency',
];

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const niche = (ctx.params?.niche as string) ?? 'digital marketing';
  const count = Math.min(Number(ctx.params?.count ?? 50), 100);

  // Synthetic 2-second delay so SSE/SDK feels real
  await new Promise(res => setTimeout(res, 2000));

  const leads = Array.from({ length: count }, (_, i) => {
    const idx = i % SAMPLE_COMPANIES.length;
    const firstName = ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Sam', 'Jamie'][i % 8];
    const lastName = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'][i % 8];
    return {
      id: `lead-stub-${i + 1}`,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${SAMPLE_DOMAINS[idx]}`,
      title: SAMPLE_TITLES[i % SAMPLE_TITLES.length],
      company: SAMPLE_COMPANIES[idx],
      domain: SAMPLE_DOMAINS[idx],
      niche,
      source: 'stub',
    };
  });

  return {
    ok: true,
    data: {
      leads,
      total: leads.length,
      niche,
      is_stub: true,
      upgrade_path: 'Connect Apollo.io or Hunter.io in Settings > Integrations to get real leads',
    },
  };
}
