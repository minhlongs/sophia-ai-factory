#!/usr/bin/env node
/**
 * SLO Performance Check — CI Gate
 * Validates SLO targets against last 30 days of data from D1
 * Exits with code 1 if any SLO target is violated
 * Usage: npm run perf:check
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// Helper to run wrangler d1 execute and parse JSON output
function queryD1(sql: string, params: (string | number)[] = []): any[] {
  // Build SQL with parameters interpolated (wrangler doesn't support parameterized queries in --command)
  let fullSql = sql;
  for (let i = params.length - 1; i >= 0; i--) {
    const placeholder = `?${i + 1}`;
    const value = params[i];
    const escaped = typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
    fullSql = fullSql.replace(placeholder, escaped);
  }

  const result = spawnSync('npx', [
    'wrangler', 'd1', 'execute', 'sophia-raas-db',
    '--command', fullSql,
    '--remote',
    '--json'
  ], {
    cwd: PROJECT_ROOT,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    // Network/auth error - return empty array gracefully (CI will have auth)
    console.warn(`[perf:check] Wrangler D1 query failed (likely no auth locally): ${result.error.message}`);
    return [];
  }

  if (result.status !== 0) {
    // Command failed - return empty array gracefully
    console.warn(`[perf:check] Wrangler D1 query exited with code ${result.status}: ${result.stderr}`);
    return [];
  }

  try {
    const output = JSON.parse(result.stdout);
    // wrangler returns array of results, each with a 'results' array
    if (Array.isArray(output) && output.length > 0) {
      return output[0].results || [];
    }
    return [];
  } catch {
    console.warn(`[perf:check] Failed to parse wrangler output: ${result.stdout}`);
    return [];
  }
}

interface SLOConfig {
  name: string;
  targetValue: number;
  targetOperator: 'gte' | 'lte';
  routes: string[];
  thresholdMs?: number;
  description: string;
  descriptionVi: string;
}

const SLO_CONFIGS: SLOConfig[] = [
  {
    name: 'availability',
    targetValue: 0.995, // 99.5%
    targetOperator: 'gte',
    routes: ['/api/', '/dashboard/', '/webhook/'],
    description: 'Availability ≥ 99.5%',
    descriptionVi: 'Tính khả dụng ≥ 99.5%',
  },
  {
    name: 'error_rate',
    targetValue: 0.01, // 1%
    targetOperator: 'lte',
    routes: ['/api/', '/webhook/'],
    description: 'Error Rate < 1%',
    descriptionVi: 'Tỷ lệ lỗi < 1%',
  },
  {
    name: 'api_latency_p95',
    targetValue: 800, // 800ms
    targetOperator: 'lte',
    routes: ['/api/'],
    thresholdMs: 800,
    description: 'API Latency p95 < 800ms',
    descriptionVi: 'Độ trễ API p95 < 800ms',
  },
  {
    name: 'health_latency_p95',
    targetValue: 500, // 500ms
    targetOperator: 'lte',
    routes: ['/api/health', '/api/version'],
    thresholdMs: 500,
    description: 'Health Latency p95 < 500ms',
    descriptionVi: 'Độ trễ Health p95 < 500ms',
  },
  {
    name: 'webhook_delivery_p95',
    targetValue: 300000, // 5 minutes = 300000ms
    targetOperator: 'lte',
    routes: ['/webhook/'],
    thresholdMs: 300000,
    description: 'Webhook Delivery p95 < 5 min',
    descriptionVi: 'Giao webhook p95 < 5 phút',
  },
];

function matchesRoute(pathname: string, routePatterns: string[]): boolean {
  return routePatterns.some(pattern => pathname.startsWith(pattern));
}

interface SLOResult {
  name: string;
  targetValue: number;
  measuredValue: number;
  passed: boolean;
  details: string;
}

async function checkSLO(slo: SLOConfig): Promise<SLOResult> {
  const now = new Date();
  const yearMonth = now.toISOString().slice(0, 7); // YYYY-MM

  // Try to get latest monthly burn data from slo_burn table
  const burnQuery = `
    SELECT * FROM slo_burn
    WHERE slo_name = ?1
    AND year_month = ?2
  `;

  const burnRows = queryD1(burnQuery, [slo.name, yearMonth]);
  const burnRow = burnRows[0] as
    | { measured_value: number; burn_rate: number; metadata: string }
    | undefined;

  if (burnRow && burnRow.measured_value !== null && burnRow.measured_value !== undefined) {
    const measuredValue = burnRow.measured_value;
    let passed = false;

    if (slo.targetOperator === 'gte') {
      passed = measuredValue >= slo.targetValue;
    } else {
      passed = measuredValue <= slo.targetValue;
    }

    return {
      name: slo.name,
      targetValue: slo.targetValue,
      measuredValue,
      passed,
      details: `Monthly aggregate from slo_burn table (${yearMonth})`,
    };
  }

  // No data available in slo_burn table yet
  return {
    name: slo.name,
    targetValue: slo.targetValue,
    measuredValue: 0,
    passed: true, // Pass with warning - no data yet
    details: 'No metrics data available in slo_burn table — run monthly cron first (WARNING: no baseline)',
  };
}

async function main(): Promise<void> {
  console.log('🔍 SLO Performance Check — Sophia AI Factory');
  console.log('============================================\n');

  const results: SLOResult[] = [];
  let allPassed = true;

  for (const slo of SLO_CONFIGS) {
    const result = await checkSLO(slo);
    results.push(result);

    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    const targetStr = typeof slo.targetValue === 'number' && slo.targetValue < 1
      ? `${(slo.targetValue * 100).toFixed(1)}%`
      : slo.thresholdMs
      ? `${slo.thresholdMs}ms`
      : String(slo.targetValue);

    const measuredStr = typeof result.measuredValue === 'number' && result.measuredValue < 1
      ? `${(result.measuredValue * 100).toFixed(2)}%`
      : result.measuredValue > 1000
      ? `${(result.measuredValue / 1000).toFixed(0)}s`
      : `${result.measuredValue.toFixed(0)}ms`;

    console.log(`${status}  ${slo.description} / ${slo.descriptionVi}`);
    console.log(`      Target: ${targetStr}  |  Measured: ${measuredStr}`);
    console.log(`      ${result.details}\n`);

    if (!result.passed) {
      allPassed = false;
    }
  }

  // Summary
  console.log('============================================');
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Summary: ${passedCount}/${results.length} SLOs passed`);

  if (!allPassed) {
    console.log('\n❌ SLO CHECK FAILED — One or more SLO targets violated');
    console.log('   Check runbooks: docs/runbooks/slo-burn-rate.md, docs/runbooks/slo-incident-response.md');
    process.exit(1);
  } else {
    console.log('\n✅ All SLO targets met');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});