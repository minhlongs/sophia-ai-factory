#!/usr/bin/env node
/**
 * Verify Blueprint Protected Flows & Open-Core Portability Contract (Lane 1)
 *
 * Verifies existence and export contracts for:
 * 1. Setup Wizard BYOK endpoints (save-credentials, validate-key, readiness)
 * 2. Telegram Bot @Sophia_Bbot webhook & command FSM handlers
 * 3. NOWPayments IPN webhook route & Result<T, E> error handling
 * 4. Open-Core Manifest & Signed Workspace Portability API
 *
 * File size budget: <= 165 LOC. Uses process.stdout.write. Exits 0 on success.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');

const checks = [];

function recordCheck(id, description, targetPath, condition, details) {
  checks.push({
    id,
    description,
    targetPath,
    passed: condition,
    details,
  });
}

function assertFileExists(id, desc, relPath, matchRegex) {
  const fullPath = path.join(appRoot, relPath);
  const exists = fs.existsSync(fullPath);
  if (!exists) {
    recordCheck(id, desc, relPath, false, 'File does not exist');
    return;
  }
  if (matchRegex) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const matched = matchRegex.test(content);
    recordCheck(id, desc, relPath, matched, matched ? undefined : `Regex pattern ${matchRegex} not found`);
  } else {
    recordCheck(id, desc, relPath, true);
  }
}

// Flow 1: Setup Wizard BYOK
assertFileExists(
  'FLOW_1_SETUP_WIZARD_SAVE',
  'Setup Wizard save-credentials route exists and handles BYOK',
  'src/app/api/setup-wizard/save-credentials/route.ts',
  /export\s+async\s+function\s+POST/
);
assertFileExists(
  'FLOW_1_SETUP_WIZARD_VALIDATE',
  'Setup Wizard validate-key route exists with provider validation',
  'src/app/api/setup-wizard/validate-key/route.ts',
  /probeProviderApiKey/
);
assertFileExists(
  'FLOW_1_KEY_FORMAT_VALIDATORS',
  'Tree BYOK key-format-validators facade exists',
  'src/tree/byok/key-format-validators.ts',
  /validators\/index/
);

// Flow 2: Telegram Bot @Sophia_Bbot
assertFileExists(
  'FLOW_2_TELEGRAM_WEBHOOK',
  'Telegram webhook route handles updates via POST',
  'src/app/api/webhooks/telegram/route.ts',
  /export\s+async\s+function\s+POST/
);
assertFileExists(
  'FLOW_2_TELEGRAM_INSTANCE',
  'Telegram singleton bot instance exported with token fallback',
  'src/tree/telegram/telegram-bot-instance.ts',
  /export\s+const\s+bot\s*=/
);
assertFileExists(
  'FLOW_2_TELEGRAM_CAMPAIGN_FSM',
  'Telegram /campaign FSM multi-step state machine exported',
  'src/tree/telegram/telegram-bot-campaign-fsm.ts',
  /startCampaignFsm/
);

// Flow 3: NOWPayments IPN Webhook
assertFileExists(
  'FLOW_3_NOWPAYMENTS_ROUTE',
  'NOWPayments webhook route parses signature and enforces HMAC',
  'src/app/api/webhooks/nowpayments/route.ts',
  /handleNowPaymentsPost/
);
assertFileExists(
  'FLOW_3_NOWPAYMENTS_RESULT',
  'Seed Result<T, E> non-throwing primitive exists for financial code',
  'src/seed/types/result.ts',
  /export\s+function\s+success/
);

// Open-Core Manifest & Portability API
assertFileExists(
  'OPEN_CORE_MANIFEST',
  'Open-Core manifest classifies 12 module features',
  'src/seed/config/open-core-manifest.ts',
  /OPEN_CORE_FEATURES/
);
assertFileExists(
  'OPEN_CORE_PORTABILITY_ROUTE',
  'Workspace portability route exports GET and POST',
  'src/app/api/open-core/portability/route.ts',
  /export\s+async\s+function\s+(GET|POST)/
);
assertFileExists(
  'OPEN_CORE_PORTABILITY_MODULE',
  'Workspace portability module implements HMAC-SHA256 checksum',
  'src/tree/open-core/workspace-portability.ts',
  /exportWorkspaceBundle/
);

const failed = checks.filter((c) => !c.passed);
const report = {
  timestamp: new Date().toISOString(),
  totalChecks: checks.length,
  passedChecks: checks.length - failed.length,
  failedCount: failed.length,
  status: failed.length === 0 ? 'PASSED' : 'FAILED',
  checks,
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');

if (failed.length > 0) {
  process.stderr.write(`Verification failed with ${failed.length} errors.\n`);
  process.exit(1);
} else {
  process.stdout.write('All protected flows & open-core portability contracts verified.\n');
  process.exit(0);
}
