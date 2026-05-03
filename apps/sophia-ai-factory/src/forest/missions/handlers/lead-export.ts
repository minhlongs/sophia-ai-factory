/**
 * Handler: lead:export
 *
 * STUB — returns a CSV string with sample leads.
 * Real implementation pending: wire real lead database + Apollo.io export via integrations.
 */

import type { MissionHandlerResult, MissionContext } from './types';

export async function handle(ctx: MissionContext): Promise<MissionHandlerResult> {
  const format = (ctx.params?.format as string) ?? 'csv';

  await new Promise(res => setTimeout(res, 2000));

  const rows = [
    ['Name', 'Email', 'Company', 'Title', 'Domain'],
    ['Alex Smith', 'alex.smith@techflow.io', 'TechFlow Solutions', 'CEO', 'techflow.io'],
    ['Jordan Johnson', 'jordan.johnson@brightmind.co', 'BrightMind Agency', 'CMO', 'brightmind.co'],
    ['Morgan Williams', 'morgan.williams@nextgendigital.com', 'NextGen Digital', 'Head of Marketing', 'nextgendigital.com'],
    ['Taylor Brown', 'taylor.brown@peakperformance.io', 'Peak Performance Co', 'VP Sales', 'peakperformance.io'],
    ['Casey Jones', 'casey.jones@cloudbase.dev', 'CloudBase Systems', 'Founder', 'cloudbase.dev'],
  ];

  const csv = rows.map(r => r.join(',')).join('\n');

  return {
    ok: true,
    data: {
      format,
      content: csv,
      row_count: rows.length - 1,
      filename: `leads-export-stub.csv`,
      is_stub: true,
      upgrade_path: 'Connect Apollo.io in Settings > Integrations to export real leads',
    },
  };
}
