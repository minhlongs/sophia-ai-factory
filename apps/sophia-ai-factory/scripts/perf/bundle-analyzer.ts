#!/usr/bin/env node
/**
 * Bundle Size Analyzer — Turbopack/OpenNext build output
 *
 * Scans the .next build output and .open-next CF Worker bundle
 * to report gzipped sizes per route and identify oversized chunks.
 * Reuses existing tooling (tsx + Node APIs) — no new dependencies.
 *
 * Usage: npx tsx scripts/perf/bundle-analyzer.ts [--json] [--threshold=N]
 *   --json       Output JSON report (for CI consumption)
 *   --threshold  Override 500KB gzipped threshold (in KB)
 */
import { readdirSync, statSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename, relative, dirname } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createLogger } from '../../src/seed/utils/logger-utility';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '../..');

const logger = createLogger('perf/bundle-analyzer');

interface ChunkInfo {
  filePath: string;
  relativePath: string;
  rawSize: number;
  gzSize: number;
}

interface RouteReport {
  route: string;
  actionFiles: ChunkInfo[];
  totalRawSize: number;
  totalGzSize: number;
  exceedsThreshold: boolean;
}

interface BundleReport {
  timestamp: string;
  thresholdKB: number;
  routes: RouteReport[];
  clientChunks: ChunkInfo[];
  serverChunks: ChunkInfo[];
  totalClientGzKB: number;
  totalServerGzKB: number;
  cfWorkerBundle: { exists: boolean; rawMB: number; gzMB: number } | null;
  violations: RouteReport[];
  oversizedServerChunks: ChunkInfo[];
  warnings: string[];
}

function gzipSize(content: Buffer): number {
  return gzipSync(content).length;
}

function analyzeFile(filePath: string, rootDir: string): ChunkInfo {
  const raw = statSync(filePath).size;
  const gz = gzipSize(readFileSync(filePath));
  return {
    filePath,
    relativePath: relative(rootDir, filePath),
    rawSize: raw,
    gzSize: gz,
  };
}

function formatSize(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function analyzeRoutes(nextDir: string): RouteReport[] {
  const chunksDir = join(nextDir, 'server', 'chunks');
  if (!existsSync(chunksDir)) {
    logger.warn('.next/server/chunks not found — skipping route analysis');
    return [];
  }

  const actionFiles = readdirSync(chunksDir).filter(
    (f) => f.endsWith('.js') && f.includes('_route_actions_')
  );

  const routeMap = new Map<string, string[]>();
  for (const f of actionFiles) {
    const match = f.match(/_next-internal_server_app_(.+?)_route_actions_/);
    if (!match) continue;
    const rawRoute = match[1]
      .replace(/_/g, '/')
      .replace(/\[([^\]]+)\]/g, ':$1');
    // rawRoute already starts with "api/" — avoid double prefix
    const route = rawRoute.startsWith('api/') ? `/${rawRoute}` : `/api/${rawRoute}`;
    const existing = routeMap.get(route) || [];
    existing.push(join(chunksDir, f));
    routeMap.set(route, existing);
  }

  const reports: RouteReport[] = [];
  for (const [route, files] of routeMap) {
    const chunks = files.map((f) => analyzeFile(f, PROJECT_ROOT));
    const totalRaw = chunks.reduce((s, c) => s + c.rawSize, 0);
    const totalGz = chunks.reduce((s, c) => s + c.gzSize, 0);

    reports.push({
      route,
      actionFiles: chunks,
      totalRawSize: totalRaw,
      totalGzSize: totalGz,
      exceedsThreshold: false,
    });
  }

  return reports.sort((a, b) => b.totalGzSize - a.totalGzSize);
}

function analyzeChunks(dir: string, pattern: RegExp): ChunkInfo[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => pattern.test(f))
    .map((f) => analyzeFile(join(dir, f), PROJECT_ROOT))
    .sort((a, b) => b.gzSize - a.gzSize);
}

function findOversized(chunks: ChunkInfo[], thresholdBytes: number): ChunkInfo[] {
  return chunks.filter((c) => c.gzSize > thresholdBytes);
}

function main(): void {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');
  const thresholdArg = args.find((a) => a.startsWith('--threshold='));
  const thresholdKB = thresholdArg
    ? parseInt(thresholdArg.split('=')[1], 10)
    : 500;
  const THRESHOLD_BYTES = thresholdKB * 1024;
  const warnings: string[] = [];

  if (!jsonOutput) {
    console.log('');
    console.log('='.repeat(60));
    console.log('  Bundle Size Analysis — Sophia AI Factory');
    console.log('='.repeat(60));
    console.log('');
  }

  // --- Route Action Files ---
  const nextDir = join(PROJECT_ROOT, '.next');
  const routeReports = analyzeRoutes(nextDir);
  const routeViolations = findOversized(
    routeReports.map((r) => ({
      filePath: r.route,
      relativePath: r.route,
      rawSize: r.totalRawSize,
      gzSize: r.totalGzSize,
    })),
    THRESHOLD_BYTES
  ).map((v) => routeReports.find((r) => r.route === v.filePath)!);

  if (!jsonOutput && routeReports.length > 0) {
    console.log('Route Action Files (Turbopack wrappers):');
    console.log('-'.repeat(60));
    for (const r of routeReports.slice(0, 20)) {
      const status = r.exceedsThreshold ? ' EXCEEDS' : '';
      console.log(
        `  ${r.route.padEnd(55)} ${formatSize(r.totalGzSize).padStart(10)}${status}`
      );
    }
    if (routeReports.length > 20) {
      console.log(`  ... and ${routeReports.length - 20} more routes`);
    }
    console.log('');
  }

  // --- Client Chunks ---
  const clientChunksDir = join(nextDir, 'static', 'chunks');
  const clientChunks = analyzeChunks(clientChunksDir, /\.js$/);
  const totalClientGz = clientChunks.reduce((s, c) => s + c.gzSize, 0);

  if (!jsonOutput) {
    console.log('Client-Side Chunks:');
    console.log('-'.repeat(60));
    console.log(
      `  Total: ${clientChunks.length} chunks, ${formatSize(totalClientGz)} gzipped`
    );
    console.log('  Top 10 by gzipped size:');
    for (const c of clientChunks.slice(0, 10)) {
      const oversized = c.gzSize > THRESHOLD_BYTES ? ' EXCEEDS 500KB' : '';
      console.log(
        `    ${basename(c.relativePath).padEnd(45)} ${formatSize(c.gzSize).padStart(10)}${oversized}`
      );
    }
    const clientOversized = findOversized(clientChunks, THRESHOLD_BYTES);
    if (clientOversized.length > 0) {
      warnings.push(
        `${clientOversized.length} client chunk(s) exceed ${thresholdKB}KB gzipped`
      );
    }
    console.log('');
  }

  // --- Server Chunks ---
  const serverChunksDir = join(nextDir, 'server', 'chunks');
  const serverChunks = analyzeChunks(serverChunksDir, /\.js$/);
  const totalServerGz = serverChunks.reduce((s, c) => s + c.gzSize, 0);

  if (!jsonOutput) {
    console.log('Server Chunks (shared modules):');
    console.log('-'.repeat(60));
    console.log(
      `  Total: ${serverChunks.length} chunks, ${formatSize(totalServerGz)} gzipped`
    );
    console.log('  Top 10 by gzipped size:');
    for (const c of serverChunks.slice(0, 10)) {
      const oversized = c.gzSize > THRESHOLD_BYTES ? ' EXCEEDS 500KB' : '';
      console.log(
        `    ${basename(c.relativePath).padEnd(45)} ${formatSize(c.gzSize).padStart(10)}${oversized}`
      );
    }
    const serverOversized = findOversized(serverChunks, THRESHOLD_BYTES);
    if (serverOversized.length > 0) {
      warnings.push(
        `${serverOversized.length} server chunk(s) exceed ${thresholdKB}KB gzipped`
      );
    }
    console.log('');
  }

  // --- CF Worker Bundle ---
  const workerPath = join(
    PROJECT_ROOT,
    '.open-next',
    'server-functions',
    'default',
    'handler.mjs'
  );
  let cfWorkerBundle: BundleReport['cfWorkerBundle'] = null;
  if (existsSync(workerPath)) {
    const raw = statSync(workerPath).size;
    const gz = gzipSize(readFileSync(workerPath));
    cfWorkerBundle = {
      exists: true,
      rawMB: raw / 1048576,
      gzMB: gz / 1048576,
    };
    if (!jsonOutput) {
      console.log('CF Worker Bundle:');
      console.log('-'.repeat(60));
      console.log(`  handler.mjs: ${formatSize(raw)} raw, ${formatSize(gz)} gzipped`);
      if (gz > 10 * 1048576) {
        warnings.push('CF Worker bundle exceeds 10MB compressed (CF limit)');
      } else if (gz > 9.5 * 1048576) {
        warnings.push('CF Worker bundle approaching 10MB limit');
      }
      console.log('');
    }
  } else if (!jsonOutput) {
    console.log('CF Worker Bundle: not found (run npm run build first)\n');
  }

  // --- Summary ---
  if (!jsonOutput) {
    console.log('='.repeat(60));
    console.log('  Summary');
    console.log('='.repeat(60));
    console.log(`  Routes analyzed: ${routeReports.length}`);
    console.log(`  Client chunks: ${clientChunks.length} (${formatSize(totalClientGz)} gz)`);
    console.log(`  Server chunks: ${serverChunks.length} (${formatSize(totalServerGz)} gz)`);
    if (cfWorkerBundle) {
      console.log(`  CF Worker: ${cfWorkerBundle.gzMB.toFixed(2)} MB gzipped`);
    }
    if (routeViolations.length > 0) {
      console.log('');
      console.log('  VIOLATIONS:');
      for (const v of routeViolations) {
        console.log(
          `    ${v.route} — ${formatSize(v.totalGzSize)} gzipped (limit: ${thresholdKB}KB)`
        );
      }
    }
    if (warnings.length > 0) {
      console.log('');
      console.log('  WARNINGS:');
      for (const w of warnings) {
        console.log(`    - ${w}`);
      }
    }
    console.log('');
  }

  // --- Write JSON report ---
  const reportDir = join(PROJECT_ROOT, '.orchestrate', 'latest');
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }
  const report: BundleReport = {
    timestamp: new Date().toISOString(),
    thresholdKB,
    routes: routeReports,
    clientChunks: clientChunks.slice(0, 20),
    serverChunks: serverChunks.slice(0, 20),
    totalClientGzKB: Math.round(totalClientGz / 1024),
    totalServerGzKB: Math.round(totalServerGz / 1024),
    cfWorkerBundle,
    violations: routeViolations,
    oversizedServerChunks: findOversized(serverChunks, THRESHOLD_BYTES),
    warnings,
  };

  const reportPath = join(reportDir, 'bundle-analysis.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  if (!jsonOutput) {
    console.log(`Report written to: ${reportPath}`);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }

  if (routeViolations.length > 0 || warnings.length > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
