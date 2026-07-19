/**
 * inject-scheduled-handler.mjs
 *
 * Post-build script: injects a `scheduled(event, env, ctx)` export into
 * .open-next/worker.js so Cloudflare Workers cron triggers have a handler.
 *
 * OpenNext-Cloudflare 1.x does not emit scheduled() natively.
 * This script appends idempotent glue code after the opennext build.
 *
 * Run: node scripts/inject-scheduled-handler.mjs
 * Called automatically by the `deploy` and `deploy:build` npm scripts.
 *
 * Idempotent: running twice produces same output (guards with marker comment).
 * Safe: if a mapped route file does not exist, the mapping is skipped.
 * Error handling: catches per-route, never throws out of scheduled().
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = join(__dirname, '..');

const workerPath = join(appRoot, '.open-next', 'worker.js');
const IDEMPOTENCY_MARKER = '/* __SCHEDULED_HANDLER_INJECTED__ */';

// ---------------------------------------------------------------------------
// Cron pattern → route(s) mapping.
// Key: exact cron expression string (must match wrangler.jsonc triggers.crons).
// Value: array of route path strings (relative to /api/).
// Routes are verified below — missing routes are skipped with a warning.
// ---------------------------------------------------------------------------
const CRON_ROUTES = {
  '* * * * *': [
    '/api/cron/workflow-stepper',
  ],
  '*/2 * * * *': [
    '/api/cron/fulfillment-retry',
    '/api/cron/email-outbox-flush',
  ],
  '*/5 * * * *': [
    '/api/cron/uptime-check',
    '/api/cron/video-status-sync',
    '/api/cron/sop-scheduler',
    '/api/cron/mission-reaper',
  ],
  '*/10 * * * *': [
    '/api/cron/heartbeat',
  ],
  '*/15 * * * *': [
    '/api/cron/smoke-one-time',
  ],
  '5 * * * *': [
    '/api/cron/usage-export',
    '/api/cron/hourly-rollup',
  ],
  '7 * * * *': [
    '/api/cron/handover-status-sync',
    '/api/cron/ab-winner-picker',
  ],
  '10 * * * *': [
    '/api/cron/wallet-rebuild',
  ],
  '0 */4 * * *': [
    '/api/cron/affiliate-scout',
  ],
  '0 0 * * *': [
    '/api/cron/clearance-promote',
    '/api/cron/promo-trial-expiry',
    '/api/cron/status-rollup',
    '/api/cron/promo-cleanup',
  '/api/cron/pending-orders-cleanup',
  ],
  '0 0 1 * *': [
    '/api/cron/mcu-monthly-reset',
  ],
  '0 1 * * *': [
    '/api/cron/dunning-advance',
  ],
  '5 1 * * *': [
    '/api/cron/daily-rollup',
  ],
  '0 2 * * *': [
    '/api/cron/subscription-reminders',
    '/api/cron/memory-consolidation',
  ],
  '0 3 * * *': [
    '/api/cron/scheduled-campaigns',
  ],
  '0 4 * * *': [
    '/api/cron/email-drip',
  ],
  '0 5 * * *': [
    '/api/cron/d1-backup',
    '/api/cron/error-digest',
    '/api/cron/quota-check',
  ],
  '0 6 * * *': [
    '/api/cron/fulfillment-reconcile',
  ],
  '0 6 * * 1': [
    '/api/cron/weekly-signals-digest',
  ],
  '0 7 * * *': [
    '/api/cron/llm-cache-purge',
  ],
};

// ---------------------------------------------------------------------------
// Verify route files exist in the Next.js source tree before including.
// Prevents stale mappings from causing runtime errors.
// ---------------------------------------------------------------------------
function routeExists(route) {
  // Strip leading /api/cron/ to get dir name
  const segments = route.replace(/^\/api\/cron\//, '');
  const routeFile = join(appRoot, 'src', 'app', 'api', 'cron', segments, 'route.ts');
  return existsSync(routeFile);
}

function buildVerifiedRouteMap() {
  const verified = {};
  for (const [pattern, routes] of Object.entries(CRON_ROUTES)) {
    const live = [];
    for (const route of routes) {
      if (routeExists(route)) {
        live.push(route);
      } else {
        console.warn(`[inject-scheduled] WARNING: route not found, skipping: ${route}`);
      }
    }
    if (live.length > 0) {
      verified[pattern] = live;
    } else {
      console.warn(`[inject-scheduled] WARNING: no live routes for pattern "${pattern}" — skipping`);
    }
  }
  return verified;
}

// ---------------------------------------------------------------------------
// Build the JS snippet to append to worker.js.
// Uses the existing `default` export (fetch handler) to dispatch internal
// requests. ctx.waitUntil() ensures fire-and-forget parallel dispatch.
// ---------------------------------------------------------------------------
function buildScheduledSnippet(verifiedMap) {
  // Serialize the verified map as a JS object literal
  const mapEntries = Object.entries(verifiedMap)
    .map(([pattern, routes]) => {
      const routeList = routes.map(r => JSON.stringify(r)).join(', ');
      return `  ${JSON.stringify(pattern)}: [${routeList}]`;
    })
    .join(',\n');

  return `
${IDEMPOTENCY_MARKER}
// Cron route map (post-build inject) — patterns must match wrangler.jsonc triggers.crons.
const __cronRouteMap = {
${mapEntries}
};

// Scheduled handler logic — exposed via default export property attachment below.
async function __cronScheduledHandler(event, env, ctx) {
  console.log('[scheduled] FIRE cron=' + event.cron + ' has_secret=' + !!env.CRON_SECRET);
  const routes = __cronRouteMap[event.cron] ?? [];

  if (routes.length === 0) {
    console.log('[scheduled] No handler for cron pattern:', event.cron);
    return;
  }

  if (!env.CRON_SECRET) {
    console.error('[scheduled] CRON_SECRET is not set — skipping all dispatches. Run scripts/set-cron-secret.sh before deploying.');
    return;
  }

  const host = env.HOSTNAME ?? 'sophia.agencyos.network';

  const dispatches = routes.map(async (route) => {
    const url = 'https://' + host + route;
    const req = new Request(url, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + env.CRON_SECRET,
      'x-internal-cron-secret': env.CRON_SECRET,
      },
    });

    try {
      const binding = env.WORKER_SELF_REFERENCE;
      const res = binding && typeof binding.fetch === 'function'
        ? await binding.fetch(req)
        : await fetch(req);
      console.log('[scheduled] ' + route + ' → ' + res.status);
    } catch (err) {
      console.error('[scheduled] Error dispatching ' + route + ':', err?.message ?? String(err));
    }
  });

  ctx.waitUntil(
    Promise.allSettled(dispatches).then((results) => {
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        console.error('[scheduled] Cron handler failures:', failures.map((f) => f.reason?.message ?? String(f.reason)));
        throw new Error(\`\${failures.length} cron handler(s) failed\`);
      }
    })
  );
}

// CRITICAL: CF Workers Modules format requires scheduled() to be a method ON the
// default export object, not a separate named export. Attach at module-load time.
// Using ESM-compatible mutation via globalThis.__defaultRef set during build is
// not feasible here — instead we re-export a wrapped default below.
// Workaround: also export named scheduled (some toolchains pick this up) and
// rely on the wrapper at end of file that overrides default export.
export async function scheduled(event, env, ctx) {
  return __cronScheduledHandler(event, env, ctx);
}
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
function main() {
  if (!existsSync(workerPath)) {
    console.error(`[inject-scheduled] ERROR: worker.js not found at ${workerPath}`);
    console.error('[inject-scheduled] Run `npm run deploy:build` (next build + opennext build) first.');
    process.exit(1);
  }

  const content = readFileSync(workerPath, 'utf8');

  if (content.includes(IDEMPOTENCY_MARKER)) {
    console.log('[inject-scheduled] Already injected — skipping (idempotent).');
    return;
  }

  const verifiedMap = buildVerifiedRouteMap();
  const patternCount = Object.keys(verifiedMap).length;
  const routeCount = Object.values(verifiedMap).flat().length;

  if (patternCount === 0) {
    console.error('[inject-scheduled] ERROR: No valid cron route mappings — aborting.');
    process.exit(1);
  }

  const snippet = buildScheduledSnippet(verifiedMap);

  // CRITICAL: scheduled() must be a method ON default export object, not a named export.
  // Inject the cron map + handler function, then modify default export to include scheduled property.
  const defaultExportRegex = /(export default \{[\s\S]*?)(\n\};)/m;
  const match = content.match(defaultExportRegex);
  if (!match) {
    console.error('[inject-scheduled] ERROR: could not find `export default { ... };` block in worker.js');
    process.exit(1);
  }

  const modifiedContent = content.replace(
    defaultExportRegex,
    (_, before, after) => {
      // If `before` already ends with `,` (object literal trailing comma), don't add another
      const needsComma = !/,\s*$/.test(before);
      const sep = needsComma ? ',\n    ' : '\n    ';
      const prop = `${sep}async scheduled(event, env, ctx) { return __cronScheduledHandler(event, env, ctx); }`;
      return `${before}${prop}${after}`;
    }
  );

  writeFileSync(workerPath, modifiedContent + snippet, 'utf8');

  console.log(`[inject-scheduled] Injected scheduled() handler into default export: ${patternCount} patterns, ${routeCount} routes.`);
  console.log('[inject-scheduled] Done.');
}

main();
