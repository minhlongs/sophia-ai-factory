/**
 * DNS TXT Resolution & Custom Domain Verification.
 *
 * Layer: tree/partners (Domain reusable)
 *
 * @module tree/partners/service/domain-dns
 */

import type { D1Database } from '@cloudflare/workers-types';
import { getWhitelabelConfigByPartnerId } from './whitelabel-config';

/**
 * Generates a DNS TXT record verification token for white-label custom domain.
 */
export function generateDnsTxtVerificationToken(partnerId: string, customDomain: string): string {
  const cleanDomain = customDomain.toLowerCase().trim();
  const tokenPayload = `${partnerId}:${cleanDomain}`;
  let hash = 0;
  for (let i = 0; i < tokenPayload.length; i++) {
    hash = (hash << 5) - hash + tokenPayload.charCodeAt(i);
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  const nonce = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  return `sophia-verify=${hex}${nonce}`;
}

/**
 * Queries DNS TXT records for a given domain using standard DNS-over-HTTPS (DoH).
 * Compatible with Cloudflare Workers edge runtime and Node.js.
 */
export async function queryDnsTxtRecords(domain: string): Promise<string[]> {
  const clean = domain.trim().toLowerCase();
  if (!clean || !clean.includes('.')) {
    return [];
  }

  try {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(clean)}&type=TXT`;
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as {
      Status: number;
      Answer?: Array<{ name: string; type: number; TTL: number; data: string }>;
    };

    if (data.Status !== 0 || !Array.isArray(data.Answer)) {
      return [];
    }

    // DNS type 16 = TXT
    return data.Answer
      .filter((record) => record.type === 16)
      .map((record) => record.data.replace(/^"|"$/g, '').trim());
  } catch {
    // If DoH query fails (e.g. offline unit test environment), fallback to Node.js dns/promises if available
    try {
      const dns = await import('node:dns/promises');
      const records = await dns.resolveTxt(clean);
      return records.map((chunks) => chunks.join(''));
    } catch {
      return [];
    }
  }
}

/**
 * Verifies DNS TXT record for custom domain and activates SSL status.
 */
export async function verifyCustomDomainDns(
  db: D1Database,
  partnerId: string,
  customDomain: string,
  dnsResolverMock?: (domain: string, expectedToken: string) => Promise<boolean>,
  nowMs = Date.now(),
): Promise<{ verified: boolean; message: string; verifiedAt?: number }> {
  const config = await getWhitelabelConfigByPartnerId(db, partnerId);
  if (!config) {
    return { verified: false, message: 'White-label config not found' };
  }

  const cleanDomain = customDomain.trim().toLowerCase();
  if (config.custom_domain?.toLowerCase() !== cleanDomain) {
    return { verified: false, message: 'Domain does not match configured custom domain' };
  }

  const expectedToken = config.dns_txt_verification_token;
  if (!expectedToken) {
    return { verified: false, message: 'No verification token generated for this domain' };
  }

  let verified = false;
  if (dnsResolverMock) {
    verified = await dnsResolverMock(cleanDomain, expectedToken);
  } else {
    // Authentic DNS TXT query via DoH / DNS resolver
    const txtRecords = await queryDnsTxtRecords(cleanDomain);
    verified = txtRecords.some((txt) => txt.includes(expectedToken) || txt === expectedToken);
  }

  if (verified) {
    await db
      .prepare(
        `UPDATE partner_whitelabel_configs
         SET is_ssl_active = 1,
             dns_verified_at = ?1,
             updated_at = ?1
         WHERE partner_id = ?2`
      )
      .bind(nowMs, partnerId)
      .run();

    return {
      verified: true,
      message: 'DNS TXT verification successful. SSL certificate provisioned.',
      verifiedAt: nowMs,
    };
  }

  return {
    verified: false,
    message: `Verification token '${expectedToken}' not detected in TXT records for ${cleanDomain}`,
  };
}
