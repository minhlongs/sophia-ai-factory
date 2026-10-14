/**
 * Affiliate Scout Cron Route
 *
 * Schedule: fixed at 0 *\/4 * * * in wrangler.toml (every 4 hours, Cloudflare managed).
 * Per-tenant cadence is enforced via tenant-settings `cron.affiliateScoutCadenceHours`.
 */

export const dynamic = 'force-dynamic';
export { GET } from './core';
