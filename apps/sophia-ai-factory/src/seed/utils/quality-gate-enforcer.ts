/**
 * Quality Gate Enforcer — Circuit Breaker Compliance Scanner
 * Scans source files to detect external HTTP calls NOT wired with circuit breaker.
 * @module seed/utils/quality-gate-enforcer
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from './index';
import { toError } from './to-error';

export interface UnwiredSite {
  file: string;
  line: number;
  url: string;
  hasTryCatch: boolean;
}

export interface UnwiredReport {
  total: number;
  unwired: UnwiredSite[];
  wired: number;
}

const FETCH_CALL_REGEX = /fetch\s*\(/g;
const URL_REGEX = /fetch\s*\(\s*["'`]([^"'`]+)/;
const INTERNAL_URL_PATTERNS = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
const CIRCUIT_BREAKER_IMPORT_PATTERNS = [
  /from\s+['"]@\/seed\/security\/circuit-breaker['"]/,
  /import\s+.*['"]@\/seed\/security\/circuit-breaker['"]/,
  /from\s+['"]@\/seed\/utils\/circuit-breaker['"]/,
];

function isExternalUrl(url: string): boolean {
  if (!url) return false;
  if (INTERNAL_URL_PATTERNS.some(p => url.includes(p))) return false;
  if (url.startsWith('/')) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

function importsCircuitBreaker(content: string): boolean {
  return CIRCUIT_BREAKER_IMPORT_PATTERNS.some(p => p.test(content));
}

function isInTryCatch(content: string, lineIndex: number): boolean {
  const lines = content.split('\n');
  let tryDepth = 0;
  for (let i = lineIndex; i >= 0; i--) {
    if (/\btry\s*\{/.test(lines[i])) {
      if (tryDepth === 0) return true;
      tryDepth--;
    }
    if (/\bcatch\s*\(/.test(lines[i]) || /\bfinally\s*\{/.test(lines[i])) tryDepth++;
  }
  return false;
}

function getLineNumber(content: string, charPos: number): number {
  return (content.substring(0, charPos).match(/\n/g) || []).length + 1;
}

function scanFile(filePath: string, srcDir: string): UnwiredSite[] {
  const sites: UnwiredSite[] = [];
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (importsCircuitBreaker(content)) return [];

    let match: RegExpExecArray | null;
    const regex = new RegExp(FETCH_CALL_REGEX.source, 'g');
    while ((match = regex.exec(content)) !== null) {
      const urlMatch = content.substring(match.index).match(URL_REGEX);
      if (urlMatch?.[1] && isExternalUrl(urlMatch[1])) {
        const line = getLineNumber(content, match.index);
        sites.push({
          file: path.relative(srcDir, filePath),
          line,
          url: urlMatch[1],
          hasTryCatch: isInTryCatch(content, line - 1),
        });
      }
    }
  } catch (err) {
    logger.error(`Failed to scan file: ${filePath}`, toError(err));
  }
  return sites;
}

function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '__tests__' && !entry.name.startsWith('.')) {
          files.push(...findTsFiles(fullPath));
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  } catch (err) {
    logger.error(`Failed to read directory: ${dir}`, toError(err));
  }
  return files;
}

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
