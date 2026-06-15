#!/usr/bin/env node
/**
 * Sophia AI Factory — Automated Screenshot Capture Script
 *
 * Captures screenshots of all app screens for documentation.
 * Requires: npx playwright install chromium
 *
 * Usage:
 *   IS_CONFIGURED=true npm run dev  (in another terminal)
 *   node scripts/capture-screenshots-for-handover-docs.mjs
 *
 * Output: docs/screenshots/*.png
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOT_DIR = join(__dirname, '..', 'docs', 'screenshots');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

mkdirSync(SCREENSHOT_DIR, { recursive: true });

const SCREENS = [
  // Setup Wizard (no auth needed, unconfigured mode)
  { path: '/setup-wizard', name: '01-setup-wizard-step1-system-check', note: 'Start with IS_CONFIGURED=false' },

  // Landing Page (configured mode)
  { path: '/en', name: '03-landing-page-hero', fullPage: true },
  { path: '/en/pricing', name: '04-pricing-page', fullPage: true },

  // Dashboard (requires auth)
  { path: '/en/dashboard', name: '05-dashboard-main', auth: true },
  { path: '/en/dashboard/create', name: '06-campaign-creation', auth: true },
  { path: '/en/dashboard/campaigns', name: '07-campaigns-list', auth: true },
  { path: '/en/dashboard/analytics', name: '08-analytics', auth: true },
  { path: '/en/dashboard/settings', name: '09-settings', auth: true },

  // Admin (requires basic auth)
  { path: '/en/admin', name: '10-admin-panel', basicAuth: true },
];

async function captureScreenshots() {
  console.log('Starting screenshot capture...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Output: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({ headless: true });

  for (const screen of SCREENS) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      ...(screen.basicAuth ? {
        httpCredentials: {
          username: process.env.ADMIN_USER || 'admin',
          password: process.env.ADMIN_PASS || 'sophia2024',
        }
      } : {})
    });

    const page = await context.newPage();
    const url = `${BASE_URL}${screen.path}`;
    const filepath = join(SCREENSHOT_DIR, `${screen.name}.png`);

    try {
      console.log(`Capturing: ${screen.path} ...`);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1000); // Wait for animations

      await page.screenshot({
        path: filepath,
        fullPage: screen.fullPage || false,
        type: 'png',
      });

      console.log(`  Saved: ${screen.name}.png`);
    } catch (err) {
      console.error(`  FAILED: ${screen.name} — ${err.message}`);
    }

    await context.close();
  }

  await browser.close();
  console.log('\nDone! Screenshots saved to docs/screenshots/');
}

captureScreenshots().catch(console.error);
