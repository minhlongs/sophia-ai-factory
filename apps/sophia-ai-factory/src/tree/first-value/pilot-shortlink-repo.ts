/**
 * Durable Cloudflare D1 repository for Customer Pilot Affiliate Shortlinks &
 * IP-hashed `SERVER_VERIFIED_CLICK` logging (`pilot_affiliate_links`, `pilot_affiliate_clicks`).
 *
 * Strictly tenant-scoped by `(org_id, user_id)`. Rejects private/loopback/IPv6/self-redirect URLs.
 *
 * @module tree/first-value/pilot-shortlink-repo
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { PilotAffiliateLinkSummary } from '@/seed/pilot/pilot-access-policy';

const SHORT_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const SELF_REDIRECT_HOSTS = new Set([
  'sophia-ai-factory-pilot.agencyos-openclaw.workers.dev',
  'sophia.agencyos.network',
]);

export function generatePilotShortCode(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += SHORT_CODE_ALPHABET[(bytes[i] ?? 0) & 0x1f];
  }
  return out;
}

export async function hashPilotVisitorIp(
  rawIp: string | null,
  hmacSecretOverride?: string,
): Promise<string> {
  const firstIp = (rawIp ?? 'unknown').split(',')[0]?.trim().toLowerCase() || 'unknown';
  const secretMaterial =
    hmacSecretOverride?.trim() ||
    process.env.FIRST_VALUE_RECEIPT_SECRET?.trim() ||
    process.env.BYOK_MASTER_KEY?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    'sophia-pilot-test-only-hmac-key-v1';
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(secretMaterial),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`pilot-click:${firstIp}`));
  return Array.from(new Uint8Array(sig))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function resolveAffiliateSubIdParam(networkHint: string): string {
  switch (networkHint.trim().toLowerCase()) {
    case 'tiktok_shop':
    case 'tiktok-shop':
      return 'aff_sub';
    case 'accesstrade':
    case 'shopee':
      return 'utm_content';
    case 'clickbank':
      return 'tid';
    case 'awin':
      return 'clickref';
    case 'amazon':
      return 'tag';
    default:
      return 'sub_id';
  }
}

export function validateHttpsDestinationUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('INVALID_URL: Affiliate destination must be a valid https:// URL');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('INVALID_URL: Only clean https:// affiliate destination URLs are allowed');
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (
    !host.includes('.') ||
    host.startsWith('[') ||
    host.endsWith(']') ||
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    SELF_REDIRECT_HOSTS.has(host) ||
    /^0\./.test(host) ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)
  ) {
    throw new Error('INVALID_URL: Private, loopback, IPv6-literal, or self-redirect hosts are forbidden');
  }
  return parsed;
}

function mapShortlinkRow(row: Record<string, unknown>, origin: string): PilotAffiliateLinkSummary {
  const code = String(row.short_code ?? '');
  return {
    id: String(row.id),
    artifactId: row.artifact_id ? String(row.artifact_id) : null,
    shortCode: code,
    shortUrl: `${origin}/api/r/${code}`,
    destinationUrl: String(row.destination_url ?? ''),
    ctaText: String(row.cta_text ?? ''),
    networkHint: String(row.network_hint ?? 'generic'),
    subId: String(row.sub_id ?? ''),
    disclosureTag: String(row.disclosure_tag ?? '#QuảngCáo'),
    verifiedClicks: Number(row.verified_clicks ?? 0),
    createdAtIso: String(row.created_at_iso ?? ''),
  };
}

export async function createPilotAffiliateShortlink(
  d1: D1Database,
  input: {
    readonly orgId: string;
    readonly userId: string;
    readonly artifactId: string | null;
    readonly destinationUrl: string;
    readonly ctaText: string;
    readonly networkHint: string;
    readonly disclosureTag: string;
    readonly baseOrigin: string;
    readonly nowIso: string;
  },
): Promise<PilotAffiliateLinkSummary> {
  const validDest = validateHttpsDestinationUrl(input.destinationUrl);
  const id = `pal_${crypto.randomUUID()}`;
  const shortCode = generatePilotShortCode(10);
  const subId = `sp_${shortCode}`;

  await d1
    .prepare(
      `INSERT INTO pilot_affiliate_links (
        id, org_id, user_id, artifact_id, short_code, destination_url,
        cta_text, network_hint, sub_id, disclosure_tag, created_at_iso, updated_at_iso
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.orgId,
      input.userId,
      input.artifactId,
      shortCode,
      validDest.toString(),
      input.ctaText.trim(),
      input.networkHint.trim() || 'generic',
      subId,
      input.disclosureTag.trim() || '#QuảngCáo',
      input.nowIso,
      input.nowIso,
    )
    .run();

  const origin = input.baseOrigin.replace(/\/+$/, '');
  return {
    id,
    artifactId: input.artifactId,
    shortCode,
    shortUrl: `${origin}/api/r/${shortCode}`,
    destinationUrl: validDest.toString(),
    ctaText: input.ctaText.trim(),
    networkHint: input.networkHint.trim() || 'generic',
    subId,
    disclosureTag: input.disclosureTag.trim() || '#QuảngCáo',
    verifiedClicks: 0,
    createdAtIso: input.nowIso,
  };
}

export async function getPilotAffiliateLinkByCodeForUser(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly shortCode: string; readonly baseOrigin: string },
): Promise<PilotAffiliateLinkSummary | null> {
  const row = await d1
    .prepare(
      `SELECT l.id, l.artifact_id, l.short_code, l.destination_url, l.cta_text,
              l.network_hint, l.sub_id, l.disclosure_tag, l.created_at_iso,
              (SELECT COUNT(1) FROM pilot_affiliate_clicks c WHERE c.link_id = l.id) AS verified_clicks
       FROM pilot_affiliate_links l
       WHERE l.org_id = ? AND l.user_id = ? AND l.short_code = ?
       LIMIT 1`,
    )
    .bind(args.orgId, args.userId, args.shortCode)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return mapShortlinkRow(row, args.baseOrigin.replace(/\/+$/, ''));
}

export async function getPilotAffiliateLinkByIdForUser(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly linkId: string; readonly baseOrigin: string },
): Promise<PilotAffiliateLinkSummary | null> {
  const row = await d1
    .prepare(
      `SELECT l.id, l.artifact_id, l.short_code, l.destination_url, l.cta_text,
              l.network_hint, l.sub_id, l.disclosure_tag, l.created_at_iso,
              0 AS verified_clicks
       FROM pilot_affiliate_links l
       WHERE l.org_id = ? AND l.user_id = ? AND l.id = ?
       LIMIT 1`,
    )
    .bind(args.orgId, args.userId, args.linkId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return mapShortlinkRow(row, args.baseOrigin.replace(/\/+$/, ''));
}

export async function listPilotAffiliateLinks(
  d1: D1Database,
  args: { readonly orgId: string; readonly userId: string; readonly baseOrigin: string },
): Promise<readonly PilotAffiliateLinkSummary[]> {
  try {
    const res = await d1
      .prepare(
        `SELECT l.id, l.artifact_id, l.short_code, l.destination_url, l.cta_text,
                l.network_hint, l.sub_id, l.disclosure_tag, l.created_at_iso,
                (SELECT COUNT(1) FROM pilot_affiliate_clicks c WHERE c.link_id = l.id) AS verified_clicks
         FROM pilot_affiliate_links l
         WHERE l.org_id = ? AND l.user_id = ?
         ORDER BY l.created_at_iso DESC
         LIMIT 20`,
      )
      .bind(args.orgId, args.userId)
      .all<Record<string, unknown>>();
    const origin = args.baseOrigin.replace(/\/+$/, '');
    return (res.results ?? []).map((r) => mapShortlinkRow(r, origin));
  } catch {
    return [];
  }
}

export async function resolveAndRecordPilotShortlinkClick(
  d1: D1Database,
  params: {
    readonly code: string;
    readonly ip: string | null;
    readonly country: string | null;
    readonly referer: string | null;
    readonly nowIso?: string;
  },
): Promise<{ readonly redirectUrl: string } | null> {
  let row: {
    id: string;
    org_id: string;
    user_id: string;
    short_code: string;
    destination_url: string;
    network_hint: string;
    sub_id: string;
  } | null = null;
  try {
    row = await d1
      .prepare(
        `SELECT id, org_id, user_id, short_code, destination_url, network_hint, sub_id
         FROM pilot_affiliate_links
         WHERE short_code = ?
         LIMIT 1`,
      )
      .bind(params.code.toLowerCase())
      .first();
  } catch {
    return null;
  }
  if (!row) return null;

  let destination: URL;
  try {
    destination = validateHttpsDestinationUrl(row.destination_url);
  } catch {
    return null;
  }
  destination.searchParams.set(resolveAffiliateSubIdParam(row.network_hint), row.sub_id);

  const ipHash = await hashPilotVisitorIp(params.ip);
  let referrerHost: string | null = null;
  if (params.referer) {
    try {
      referrerHost = new URL(params.referer).hostname.slice(0, 128);
    } catch {
      referrerHost = null;
    }
  }

  try {
    await d1
      .prepare(
        `INSERT INTO pilot_affiliate_clicks (
          id, link_id, org_id, user_id, short_code, ip_hash,
          country_code, referrer_host, provenance, clicked_at_iso
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SERVER_VERIFIED_CLICK', ?)`,
      )
      .bind(
        `pac_${crypto.randomUUID()}`,
        row.id,
        row.org_id,
        row.user_id,
        row.short_code,
        ipHash,
        params.country ? params.country.slice(0, 8) : null,
        referrerHost,
        params.nowIso ?? new Date().toISOString(),
      )
      .run();
  } catch {
    // Redirect proceeds if click write contends transiently
  }

  return { redirectUrl: destination.toString() };
}
