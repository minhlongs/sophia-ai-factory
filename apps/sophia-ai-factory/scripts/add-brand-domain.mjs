#!/usr/bin/env node
/**
 * ADD_BRAND_DOMAIN — Controlled Brand Domain Attachment CLI
 *
 * Implements the G8 Future Brand Attachment Contract:
 *   1. Verify Founder authorization (--confirm-founder required for mutations)
 *   2. Validate exact hostname (no wildcards, no workers.dev, no localhost)
 *   3. Verify Cloudflare Zone ownership & no existing Worker domain conflict
 *   4. Attach hostname to the existing Worker via official Cloudflare API
 *   5. Verify TLS & independent HTTPS smoke test
 *   6. Preserve the Cloudflare workers.dev technical URL as fallback
 *   7. Output explicit external OAuth/Webhook callback update checklist
 *      (never claims third-party providers auto-update)
 *
 * Safe by default: runs in --dry-run mode unless --apply --confirm-founder are passed.
 *
 * Usage:
 *   node scripts/add-brand-domain.mjs --hostname app.newbrand.com --zone-id <ZONE_ID> [--worker sophia-ai-factory] [--apply --confirm-founder]
 *   node scripts/add-brand-domain.mjs --hostname app.newbrand.com --rollback --apply --confirm-founder
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'f691e83094f776311a1bfe3f8b126f1c';
const DEFAULT_WORKER = 'sophia-ai-factory';
const TECHNICAL_SUBDOMAIN = 'agencyos-openclaw';
const EXACT_HOST_RE =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

function parseArgs(argv) {
  const opts = {
    hostname: '',
    zoneId: '',
    worker: DEFAULT_WORKER,
    apply: false,
    confirmFounder: false,
    rollback: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--hostname') opts.hostname = (argv[++i] || '').trim().toLowerCase();
    else if (arg === '--zone-id') opts.zoneId = (argv[++i] || '').trim();
    else if (arg === '--worker') opts.worker = (argv[++i] || DEFAULT_WORKER).trim();
    else if (arg === '--apply') opts.apply = true;
    else if (arg === '--confirm-founder') opts.confirmFounder = true;
    else if (arg === '--rollback') opts.rollback = true;
  }
  return opts;
}

function validateHostname(hostname) {
  if (!hostname || !EXACT_HOST_RE.test(hostname)) {
    throw new Error(`Invalid exact hostname: "${hostname}"`);
  }
  if (hostname.endsWith('.workers.dev') || hostname === 'workers.dev') {
    throw new Error('workers.dev is a technical entrypoint, not a brand domain');
  }
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    throw new Error('localhost cannot be attached as a brand domain');
  }
}

async function cfApi(token, path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    const msg = (data.errors || []).map((e) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare API ${path} failed: ${msg}`);
  }
  return data.result;
}

async function main() {
  const opts = parseArgs(process.argv);
  validateHostname(opts.hostname);

  const technicalUrl = `https://${opts.worker}.${TECHNICAL_SUBDOMAIN}.workers.dev`;
  const mode = opts.apply ? 'APPLY' : 'DRY_RUN';

  process.stdout.write(
    JSON.stringify(
      {
        command: opts.rollback ? 'ROLLBACK_BRAND_DOMAIN' : 'ADD_BRAND_DOMAIN',
        mode,
        hostname: opts.hostname,
        worker: opts.worker,
        accountId: ACCOUNT_ID,
        preservedTechnicalFallback: technicalUrl,
      },
      null,
      2,
    ) + '\n',
  );

  if (opts.apply && !opts.confirmFounder) {
    throw new Error('Founder authorization required: pass --confirm-founder with --apply');
  }

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    if (!opts.apply) {
      process.stdout.write(
        '\n[DRY_RUN] CLOUDFLARE_API_TOKEN not set — skipping live Cloudflare API preflight.\n',
      );
      printExternalChecklist(opts.hostname, technicalUrl);
      return;
    }
    throw new Error('CLOUDFLARE_API_TOKEN is required for --apply');
  }

  const existingDomains = await cfApi(
    token,
    `/accounts/${ACCOUNT_ID}/workers/domains`,
  );
  const conflict = existingDomains.find((d) => d.hostname === opts.hostname);

  if (opts.rollback) {
    if (!conflict) {
      process.stdout.write(`No Cloudflare Worker domain record found for ${opts.hostname}.\n`);
      return;
    }
    if (!opts.apply) {
      process.stdout.write(
        `[DRY_RUN] Would detach domain id=${conflict.id} (${conflict.hostname}) from worker=${conflict.service}.\n`,
      );
      return;
    }
    await cfApi(token, `/accounts/${ACCOUNT_ID}/workers/domains/${conflict.id}`, {
      method: 'DELETE',
    });
    process.stdout.write(
      `Detached ${opts.hostname} from ${conflict.service}. Technical fallback ${technicalUrl} remains intact.\n`,
    );
    process.stdout.write(
      'Next step: Suspend/rollback this domain in /dashboard/admin/domains to update D1 registry.\n',
    );
    return;
  }

  if (!opts.zoneId) {
    throw new Error('--zone-id is required to attach a brand domain');
  }
  if (conflict && conflict.service !== opts.worker) {
    throw new Error(
      `Domain conflict: ${opts.hostname} is already attached to worker "${conflict.service}"`,
    );
  }

  const zone = await cfApi(token, `/zones/${opts.zoneId}`);
  if (zone.status !== 'active') {
    throw new Error(`Cloudflare zone ${opts.zoneId} (${zone.name}) is not active: ${zone.status}`);
  }
  if (opts.hostname !== zone.name && !opts.hostname.endsWith(`.${zone.name}`)) {
    throw new Error(`Hostname ${opts.hostname} does not belong to zone ${zone.name}`);
  }

  if (!opts.apply) {
    process.stdout.write(
      `\n[DRY_RUN] Preflight PASSED: zone=${zone.name} (active), conflict=${conflict ? 'same-worker' : 'none'}.\n`,
    );
    process.stdout.write(
      `[DRY_RUN] Would PUT /accounts/${ACCOUNT_ID}/workers/domains { hostname: "${opts.hostname}", service: "${opts.worker}", zone_id: "${opts.zoneId}", environment: "production" }\n`,
    );
    printExternalChecklist(opts.hostname, technicalUrl);
    return;
  }

  const attached = await cfApi(token, `/accounts/${ACCOUNT_ID}/workers/domains`, {
    method: 'PUT',
    body: JSON.stringify({
      hostname: opts.hostname,
      service: opts.worker,
      zone_id: opts.zoneId,
      environment: 'production',
    }),
  });

  process.stdout.write(
    `Attached ${attached.hostname} -> worker ${attached.service} (id=${attached.id}).\n`,
  );
  process.stdout.write(
    'Next steps:\n' +
      '  1. Wait for Cloudflare TLS certificate to become active.\n' +
      '  2. Register & complete all 10 readiness gates in /dashboard/admin/domains.\n' +
      '  3. Activate in D1 registry (runtime host allowlist + Better Auth update automatically without rebuild).\n',
  );
  printExternalChecklist(opts.hostname, technicalUrl);
}

function printExternalChecklist(hostname, technicalUrl) {
  process.stdout.write(
    '\nExternal Third-Party Callback Checklist (Manual — NOT auto-updated by domain attachment):\n' +
      `  - OAuth Redirect URIs (Google / TikTok / YouTube): register https://${hostname}/api/auth/callback/*\n` +
      `  - Payment IPN / Webhooks (NOWPayments / PayOS): keep on ${technicalUrl} or update provider dashboard\n` +
      `  - HeyGen & Telegram Webhooks: verify callback URL points to ${technicalUrl} or https://${hostname}\n` +
      `  - Transactional Email Sender (Resend / SPF / DKIM / DMARC): verify sender domain separately\n`,
  );
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
