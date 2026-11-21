/**
 * inject-scheduled-handler.mjs
 *
 * Post-build script: injects a `scheduled(event, env, ctx)` export into
 * .open-next/worker.js so Cloudflare Workers cron triggers have a handler.
 *
 * Idempotent: running twice produces the same output (guarded with marker).
 * Fail-fast: build fails if any mapped route is missing; runtime scheduled()
 * throws on missing CRON_SECRET, HTTP non-2xx responses, or dispatch errors.
 */

import { createRequire } from 'node:module';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const appRoot = join(__dirname, '..');

const workerPath = join(appRoot, '.open-next', 'worker.js');
export const IDEMPOTENCY_MARKER = '/* __SCHEDULED_HANDLER_INJECTED__ */';

// Cron pattern -> route(s) mapping.
// Keys use single quotes to preserve compatibility with ci-check-cron-alignment.sh.
export const CRON_ROUTES = {
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
    '/api/cron/circuit-breaker-scan',
    '/api/cron/distribution-pipeline-scan',
    '/api/cron/agent-cost-overrun-scan',
  ],
  '0 * * * *': [
    '/api/cron/creative-quality-drift-scan',
  ],
  '5 * * * *': [
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
    '/api/cron/slo-burn-rate',
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
  '30 3 * * *': [
    '/api/cron/hash-chain-verification',
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
    '/api/cron/billing-anomaly-scan',
  ],
  '*/30 * * * *': [
    '/api/cron/mission-abandon-scan',
  ],
};

export function routeExists(route, rootDir = appRoot) {
  if (typeof route !== 'string' || !/^\/api\/cron\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/i.test(route)) {
    return false;
  }
  const segments = route.replace(/^\/api\/cron\//, '');
  const routeFile = join(rootDir, 'src', 'app', 'api', 'cron', segments, 'route.ts');
  return existsSync(routeFile);
}

export function buildVerifiedRouteMap(routeMap = CRON_ROUTES, rootDir = appRoot) {
  if (!routeMap || typeof routeMap !== 'object') {
    throw new Error('Cron route map must be a non-empty object.');
  }

  const entries = Object.entries(routeMap);
  if (entries.length === 0) {
    throw new Error('No cron route patterns configured.');
  }

  const verified = {};
  const missingRoutes = [];

  for (const [pattern, routes] of entries) {
    if (typeof pattern !== 'string' || pattern.trim().length === 0) {
      throw new Error('Cron pattern key must be a non-empty string.');
    }
    if (!Array.isArray(routes) || routes.length === 0) {
      throw new Error(`Cron pattern "${pattern}" has no configured routes.`);
    }

    for (const route of routes) {
      if (!routeExists(route, rootDir)) {
        missingRoutes.push(`${pattern} -> ${String(route)}`);
      }
    }
    verified[pattern] = [...routes];
  }

  if (missingRoutes.length > 0) {
    throw new Error(`Missing cron route file(s): ${missingRoutes.join(', ')}`);
  }

  return verified;
}

export function assertCronAlignment(routeMap, rootDir = appRoot) {
  const config = readFileSync(join(rootDir, 'wrangler.toml'), 'utf8');
  const triggers = config.match(/^\[triggers\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  const cronArray = triggers?.match(/^crons\s*=\s*(\[[\s\S]*?\])/m)?.[1];
  if (!cronArray) throw new Error('Missing triggers.crons in wrangler.toml.');
  const crons = JSON.parse(cronArray);
  const configured = new Set(crons);
  const mapped = new Set(Object.keys(routeMap));
  const unmapped = [...configured].filter((cron) => !mapped.has(cron));
  const unscheduled = [...mapped].filter((cron) => !configured.has(cron));
  if (unmapped.length || unscheduled.length) {
    throw new Error(`Cron alignment failed: unmapped triggers [${unmapped.join(', ')}]; unscheduled handlers [${unscheduled.join(', ')}]`);
  }
}

// Keep the scheduler and HTTP policy synchronized.
const cronPolicy = JSON.parse(readFileSync(join(appRoot, 'src/seed/security/scheduled-cron-policy.json'), 'utf8'));
export const PERMITTED_CRON_ROUTES = Object.freeze(cronPolicy.permittedRoutes);
const registeredRoutes = Object.values(CRON_ROUTES).flat().sort();
if (JSON.stringify(registeredRoutes) !== JSON.stringify(cronPolicy.registeredRoutes) ||
    PERMITTED_CRON_ROUTES.some((route) => !registeredRoutes.includes(route))) {
  throw new Error('Scheduled cron policy does not match the registry');
}

function bundleBackup() {
  const require = createRequire(import.meta.url);
  const { buildSync } = require('esbuild');
  const result = buildSync({
    entryPoints: [join(appRoot, 'src/forest/dr/scheduled-d1-backup.ts')],
    bundle: true, write: false, format: 'iife', globalName: '__scheduledBackup',
    platform: 'browser', target: 'es2022',
  });
  return result.outputFiles[0].text;
}

export function buildScheduledSnippet(verifiedMap, permittedRoutes = PERMITTED_CRON_ROUTES) {
  const mapEntries = Object.entries(verifiedMap)
    .map(([pattern, routes]) => {
      const routeList = routes.map((r) => JSON.stringify(r)).join(', ');
      return `  ${JSON.stringify(pattern)}: [${routeList}]`;
    })
    .join(',\n');

  return `
${IDEMPOTENCY_MARKER}
${bundleBackup()}
// Cron route map (post-build inject) — patterns must match wrangler triggers.crons.
const __permittedCronRoutes = new Set(${JSON.stringify(permittedRoutes)});
const __cronRouteMap = {
${mapEntries}
};

async function __cronScheduledHandler(event, env, ctx) {
  const cronPattern = typeof event?.cron === 'string' ? event.cron : '';
  const hasSecret = Boolean(env && typeof env.CRON_SECRET === 'string' && env.CRON_SECRET.trim().length > 0);
  console.log('[scheduled] FIRE cron=' + cronPattern + ' has_secret=' + hasSecret);

  if (!hasSecret) {
    throw new Error('[scheduled] CRON_SECRET is missing or empty; refusing to dispatch cron routes.');
  }

  const routes = Object.hasOwn(__cronRouteMap, cronPattern) ? __cronRouteMap[cronPattern] : [];
  if (routes.length === 0) {
    console.warn('[scheduled] No handler mapped for cron pattern');
    return;
  }
  const permittedRoutes = routes.filter((route) => __permittedCronRoutes.has(route));
  const skippedRoutes = routes.filter((route) => !__permittedCronRoutes.has(route));

  if (skippedRoutes.length > 0) {
    console.warn('[scheduled] Routes skipped by policy:', skippedRoutes.join(', '));
  }

  if (permittedRoutes.length === 0) {
    return {
      ok: true,
      skipped: 'SKIPPED_BY_POLICY',
      routes: skippedRoutes,
    };
  }

  const routesToDispatch = permittedRoutes;
  const host = typeof env.HOSTNAME === 'string' && env.HOSTNAME.trim().length > 0
    ? env.HOSTNAME.trim()
    : 'worker.invalid';

  const runPromise = (async () => {
    const results = await Promise.allSettled(
      routesToDispatch.map(async (route) => {
        if (route === '/api/cron/d1-backup') {
          const result = await __scheduledBackup.runScheduledD1Backup({ DB: env.DB, BACKUPS_BUCKET: env.BACKUPS_BUCKET });
          if (!result.ok) throw new Error(route + ' failed: ' + result.reason + (result.artifactPresent ? ' artifactPresent=true' : ''));
          return result;
        }
        const url = 'https://' + host + route;
        const req = new Request(url, {
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + env.CRON_SECRET,
          },
        });

        let res;
        try {
          const binding = env.WORKER_SELF_REFERENCE;
          if (!binding || typeof binding.fetch !== 'function') {
            throw new Error('WORKER_SELF_REFERENCE is unavailable');
          }
          res = await binding.fetch(req);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(route + ' dispatch failed: ' + message, { cause: err });
        }

        if (!res || typeof res.status !== 'number') {
          throw new Error(route + ' returned an invalid HTTP response');
        }

        if (res.body && typeof res.body.cancel === 'function') {
          await res.body.cancel().catch(() => {});
        }

        const isOk = res.status >= 200 && res.status < 300;
        if (!isOk) {
          throw new Error(route + ' failed with HTTP ' + res.status);
        }

        console.log('[scheduled] ' + route + ' -> ' + res.status);
        return res.status;
      })
    );

    const failures = results
      .filter((r) => r.status === 'rejected')
      .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

    if (failures.length > 0) {
      console.error('[scheduled] Cron handler failures:', failures);
      throw new Error(
        '[scheduled] ' + failures.length + ' of ' + routesToDispatch.length +
        ' cron route(s) failed for "' + cronPattern + '": ' + failures.join('; ')
      );
    }
  })();

  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(runPromise.catch(() => {}));
  }

  await runPromise;
}

export async function scheduled(event, env, ctx) {
  return __cronScheduledHandler(event, env, ctx);
}
`;
}

export function injectScheduledHandler({
  workerFilePath = workerPath,
  routeMap = CRON_ROUTES,
  rootDir = appRoot,
  permittedRoutes = PERMITTED_CRON_ROUTES,
} = {}) {
  if (!existsSync(workerFilePath)) {
    throw new Error(
      `worker.js not found at ${workerFilePath}. Run \`npm run deploy:build\` first.`
    );
  }

  const verifiedMap = buildVerifiedRouteMap(routeMap, rootDir);
  assertCronAlignment(verifiedMap, rootDir);
  const content = readFileSync(workerFilePath, 'utf8');
  if (content.includes(IDEMPOTENCY_MARKER)) {
    return { injected: false, patternCount: 0, routeCount: 0 };
  }

  const patternCount = Object.keys(verifiedMap).length;
  const routeCount = Object.values(verifiedMap).flat().length;
  const snippet = buildScheduledSnippet(verifiedMap, permittedRoutes);

  const defaultExportRegex = /(export default \{[\s\S]*?)(\n\};)/m;
  if (!defaultExportRegex.test(content)) {
    throw new Error('Could not find `export default { ... };` block in worker.js.');
  }

  const modifiedContent = content.replace(defaultExportRegex, (_, before, after) => {
    const needsComma = !/,\s*$/.test(before);
    const sep = needsComma ? ',\n    ' : '\n    ';
    const prop = `${sep}async scheduled(event, env, ctx) { return __cronScheduledHandler(event, env, ctx); }`;
    return `${before}${prop}${after}`;
  });

  writeFileSync(workerFilePath, modifiedContent + snippet, 'utf8');
  return { injected: true, patternCount, routeCount };
}

function main() {
  try {
    const result = injectScheduledHandler();
    if (!result.injected) {
      console.log('[inject-scheduled] Already injected — skipping (idempotent).');
      return;
    }
    console.log(
      `[inject-scheduled] Injected scheduled() handler into default export: ${result.patternCount} patterns, ${result.routeCount} routes.`
    );
    console.log('[inject-scheduled] Done.');
  } catch (err) {
    console.error('[inject-scheduled] ERROR:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
const isMainModule =
  invokedPath !== '' &&
  (invokedPath === __filename ||
    (existsSync(invokedPath) && realpathSync(invokedPath) === realpathSync(__filename)));

if (isMainModule) {
  main();
}
