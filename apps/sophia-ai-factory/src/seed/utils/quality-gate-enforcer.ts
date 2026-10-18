/**
 * Quality Gate Enforcer — Circuit Breaker Compliance Scanner
 * Scans source files to detect external HTTP calls NOT wired with circuit breaker.
 * @module seed/utils/quality-gate-enforcer
 */

import * as fs from 'fs';
import { logger } from './index';
import {
  findTsFiles,
  importsCircuitBreaker,
  scanFile,
  type UnwiredReport,
  type UnwiredSite,
} from './quality-gate-scanner';

export type { UnwiredReport, UnwiredSite };

/** Scan directory for external HTTP calls not wired with circuit breaker. */
export function scanForUnwiredExternalCalls(srcDir: string): UnwiredReport {
  logger.info(`Scanning for unwired external calls in: ${srcDir}`);
  const files = findTsFiles(srcDir);
  const unwired: UnwiredSite[] = [];
  let wired = 0;

  for (const file of files) {
    const sites = scanFile(file, srcDir);
    if (sites.length > 0) {
      unwired.push(...sites);
    } else if (importsCircuitBreaker(fs.readFileSync(file, 'utf-8'))) {
      wired++;
    }
  }

  const report: UnwiredReport = { total: files.length, unwired, wired };
  logger.info(`Scan complete: ${report.total} files, ${report.unwired.length} unwired, ${report.wired} wired`);
  return report;
}

/** Print scan report using logger (not console.log). */
export function printReport(report: UnwiredReport): void {
  logger.info('=== Circuit Breaker Compliance Report ===');
  logger.info(`Total files scanned: ${report.total}`);
  logger.info(`Wired correctly: ${report.wired}`);
  logger.info(`Unwired violations: ${report.unwired.length}`);

  if (report.unwired.length === 0) {
    logger.info('All external HTTP calls are properly wired with circuit breaker.');
    return;
  }

  logger.warn('Unwired external HTTP call sites:');
  for (const site of report.unwired) {
    logger.warn(`  - ${site.file}:${site.line} -> ${site.url} (try-catch: ${site.hasTryCatch})`);
  }
}

const qualityGateEnforcer = { scanForUnwiredExternalCalls, printReport };
export default qualityGateEnforcer;
