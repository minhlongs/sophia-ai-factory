#!/usr/bin/env tsx
/**
 * verify-email-dns.ts
 *
 * Queries DNS for the Sophia AI Factory sending domain and reports
 * presence/absence of SPF, DKIM, and DMARC records.
 *
 * Usage:
 *   pnpm dlx tsx scripts/verify-email-dns.ts [domain]
 *
 * Default domain: mekongmind.com (Resend sending domain)
 * Override: RESEND_DOMAIN env var or positional arg.
 *
 * Output: structured report to stdout; exit 1 if any required record is missing.
 */

import { promises as dns } from 'dns';

const DOMAIN = process.argv[2] ?? process.env.RESEND_DOMAIN ?? 'mekongmind.com';

// Resend DKIM selector — Resend uses "resend" as the default selector.
// Operator must confirm in Resend dashboard → Domains → <domain> → DNS records.
const DKIM_SELECTOR = process.env.DKIM_SELECTOR ?? 'resend';

interface DnsCheckResult {
  record: string;
  host: string;
  found: boolean;
  value: string;
  required: string;
  status: 'OK' | 'MISSING' | 'PARTIAL';
}

async function lookupTxt(host: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(host);
    return records.map((r) => r.join(''));
  } catch {
    return [];
  }
}

async function checkSpf(domain: string): Promise<DnsCheckResult> {
  const host = domain;
  const records = await lookupTxt(host);
  const spfRecords = records.filter((r) => r.startsWith('v=spf1'));

  // Resend requires include:amazonses.com or similar; also Resend may use
  // include:_spf.resend.com — operator must verify in Resend dashboard.
  const required = 'v=spf1 include:amazonses.com ~all (or Resend equivalent)';

  if (spfRecords.length === 0) {
    return { record: 'SPF', host, found: false, value: '', required, status: 'MISSING' };
  }

  const value = spfRecords[0];
  // Basic sanity: must include some authoritative include directive
  const hasInclude = value.includes('include:') || value.includes('ip4:') || value.includes('ip6:');
  return {
    record: 'SPF',
    host,
    found: true,
    value,
    required,
    status: hasInclude ? 'OK' : 'PARTIAL',
  };
}

async function checkDkim(domain: string, selector: string): Promise<DnsCheckResult> {
  const host = `${selector}._domainkey.${domain}`;
  const records = await lookupTxt(host);
  const required = `TXT record at ${host} with v=DKIM1; k=rsa; p=<public_key>`;

  if (records.length === 0) {
    return { record: 'DKIM', host, found: false, value: '', required, status: 'MISSING' };
  }

  const value = records[0];
  // DKIM valid if public key present (p=...) — some providers omit v=DKIM1 header
  const isValidDkim = value.includes('p=') && value.length > 20;
  return {
    record: 'DKIM',
    host,
    found: true,
    value: value.length > 120 ? value.slice(0, 120) + '…' : value,
    required,
    status: isValidDkim ? 'OK' : 'PARTIAL',
  };
}

async function checkDmarc(domain: string): Promise<DnsCheckResult> {
  const host = `_dmarc.${domain}`;
  const records = await lookupTxt(host);
  const required = `TXT record at ${host} with v=DMARC1; p=none; rua=mailto:dmarc@${domain}`;

  if (records.length === 0) {
    return { record: 'DMARC', host, found: false, value: '', required, status: 'MISSING' };
  }

  const value = records[0];
  const hasPolicy = value.includes('p=none') || value.includes('p=quarantine') || value.includes('p=reject');
  return {
    record: 'DMARC',
    host,
    found: true,
    value,
    required,
    status: hasPolicy ? 'OK' : 'PARTIAL',
  };
}

function renderRow(result: DnsCheckResult): void {
  const icon = result.status === 'OK' ? '✅' : result.status === 'PARTIAL' ? '⚠️ ' : '❌';
  console.log(`${icon} ${result.record}`);
  console.log(`   Host    : ${result.host}`);
  console.log(`   Status  : ${result.status}`);
  if (result.found) {
    console.log(`   Value   : ${result.value}`);
  } else {
    console.log(`   Value   : (not found)`);
    console.log(`   Required: ${result.required}`);
  }
  console.log('');
}

async function main(): Promise<void> {
  console.log(`\n=== Email DNS Verification Report ===`);
  console.log(`Domain    : ${DOMAIN}`);
  console.log(`DKIM sel. : ${DKIM_SELECTOR}`);
  console.log(`Timestamp : ${new Date().toISOString()}`);
  console.log(`${'─'.repeat(50)}\n`);

  const [spf, dkim, dmarc] = await Promise.all([
    checkSpf(DOMAIN),
    checkDkim(DOMAIN, DKIM_SELECTOR),
    checkDmarc(DOMAIN),
  ]);

  renderRow(spf);
  renderRow(dkim);
  renderRow(dmarc);

  const allOk = [spf, dkim, dmarc].every((r) => r.status === 'OK');
  const missing = [spf, dkim, dmarc].filter((r) => r.status === 'MISSING').map((r) => r.record);

  console.log(`${'─'.repeat(50)}`);
  if (allOk) {
    console.log('RESULT: ✅ All email DNS records verified — emails should deliver and pass authentication.');
  } else if (missing.length > 0) {
    console.log(`RESULT: ❌ Missing records: ${missing.join(', ')}`);
    console.log('ACTION: Add the missing DNS records in Cloudflare DNS panel.');
    console.log('        See docs/runbooks/email-dns-setup.md for exact record values.');
  } else {
    console.log('RESULT: ⚠️  Records present but may be misconfigured — review values above.');
  }
  console.log('');

  if (!allOk) process.exit(1);
}

main().catch((err: unknown) => {
  console.error('DNS verification error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
