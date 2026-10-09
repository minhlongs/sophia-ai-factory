/**
 * @file types.ts
 * @description Constants and types for Cloudflare custom domain verification.
 * @layer tree
 */

export const DEFAULT_CNAME_TARGET = 'cname.sophia.agencyos.network';

export const HOSTNAME_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;

export const FORBIDDEN_DOMAINS = new Set([
  'sophia.agencyos.network',
  'agencyos.network',
  'localhost',
  'workers.dev',
  'pages.dev',
]);
