#!/usr/bin/env node
/**
 * post-deploy-smoke.mjs — Post-deployment verification
 * Exit codes: 0=green, 1=failed, 2=usage error, 3=skipped
 *
 * Runs after deploy to verify production is healthy.
 * Bypass: SKIP_SMOKE_TEST=1
 */

import * as childProcess from 'child_process';
import * as fs from 'fs';
import { resolve, join } from 'path';

const DEFAULT_TIMEOUT_MS = 10000;

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkEndpoint(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const headers = options.authToken
      ? { Authorization: `Bearer ${options.authToken}` }
      : undefined;
    const response = await fetch(url, { signal: controller.signal, headers });
    clearTimeout(timeoutHandle);
    const duration = Date.now() - start;

    return {
      name: options.name || url,
      passed: response.ok,
      statusCode: response.status,
      url,
      duration,
    };
  } catch (error) {
    clearTimeout(timeoutHandle);
    const errorMsg = error.name === 'AbortError' ? 'timeout' : error.message;
    return {
      name: options.name || url,
      passed: false,
      error: errorMsg,
      url,
      duration: Date.now() - start,
    };
  }
}

async function checkApiHealth(baseUrl) {
  const authToken = process.env.API_TOKEN;
  return await checkEndpoint(`${baseUrl}/api/health`, {
    name: 'API Health',
    authToken,
  });
}

async function checkVersionEndpoint(baseUrl, expectedShortSha) {
  try {
    const response = await fetch(`${baseUrl}/api/version`);
    if (!response.ok) {
      return {
        name: 'Version endpoint',
        passed: false,
        reason: `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }
    const data = await response.json();
    const liveSha = data.shortSha;
    if (!liveSha) {
      return {
        name: 'Version endpoint',
        passed: false,
        reason: 'Missing shortSha',
      };
    }
    if (liveSha !== expectedShortSha) {
      return {
        name: 'Version endpoint',
        passed: false,
        reason: `${expectedShortSha} (local) vs ${liveSha} (live)`,
        statusCode: response.status,
      };
    }
    return {
      name: 'Version endpoint',
      passed: true,
      statusCode: response.status,
    };
  } catch (error) {
    return {
      name: 'Version endpoint',
      passed: false,
      error: error.message,
    };
  }
}

function generateReport(results, baseUrl) {
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  return {
    timestamp: new Date().toISOString(),
    url: baseUrl,
    summary: { passed, failed, total: results.length },
    results,
  };
}

async function runSmokeChecks(baseUrl, expectedShortSha, outputPath) {
  if (process.env.SKIP_SMOKE_TEST === '1') {
    return {
      skipped: true,
      reason: 'SKIP_SMOKE_TEST=1',
      summary: { passed: 0, failed: 0, total: 0 },
    };
  }

  const checks = [];

  const healthCheck = await checkApiHealth(baseUrl);
  checks.push(healthCheck);

  if (expectedShortSha) {
    const versionCheck = await checkVersionEndpoint(baseUrl, expectedShortSha);
    checks.push(versionCheck);
  }

  const report = generateReport(checks, baseUrl);

  if (outputPath) {
    const dir = resolve(process.cwd(), 'apps/sophia-ai-factory');
    const filePath = join(dir, outputPath);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
  }

  return report;
}

// CLI entry point
if (process.argv[1] === import.meta.url) {
  const baseUrl = process.argv[2] || process.env.PROD_URL || 'https://sophia.agencyos.network';
  const localSha = process.argv[3] || process.env.LOCAL_SHA || '';
  const outputPath = process.argv[4] || process.env.SMOKE_REPORT_PATH;

  runSmokeChecks(baseUrl, localSha, outputPath)
    .then(report => {
      const { passed, failed } = report.summary;
      console.log(`\nSmoke Test Results: ${passed} passed, ${failed} failed`);
      for (const r of report.results) {
        const icon = r.passed ? '✅' : '❌';
        console.log(`${icon} ${r.name}${r.reason ? ` — ${r.reason}` : ''}`);
      }
      process.exit(report.summary.failed > 0 ? 1 : 0);
    })
    .catch(err => {
      console.error('Smoke test crashed:', err);
      process.exit(2);
    });
}

export {
  checkEndpoint,
  checkApiHealth,
  checkVersionEndpoint,
  generateReport,
  runSmokeChecks,
};
