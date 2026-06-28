#!/usr/bin/env tsx
/**
 * BYOK guide screenshot capturer.
 *
 * Generates the 3 fallback PNG hints rendered by ByokHelpTip
 * (`public/byok-guide/{openrouter,elevenlabs,d-id}.png`) at the
 * exact dimensions the component expects (960x320, 3:1 crop).
 *
 * Strategy: open each provider's public API-keys / docs page,
 * crop to 960x320 starting at the top of the main content area.
 *
 * Limitation: pages that require login (e.g. real key dashboard)
 * cannot be captured headlessly — this script captures the public
 * pricing / docs landing page as a "good enough" hint. Founder can
 * replace any PNG with a real screenshot from their own account
 * for a more accurate visual.
 *
 * Usage:
 *   npx tsx scripts/capture-byok-screenshots.ts
 *
 * Requires:
 *   @playwright/test (already a dev dep)
 *   chromium browser (auto-downloaded on first run: `npx playwright install chromium`)
 */
import { chromium, type Browser } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

interface Target {
  provider: string;
  url: string;
  /** Where to scroll before cropping (px from top). */
  scrollY?: number;
  /** Optional CSS to hide cookie banners / popups before capture. */
  hideSelectors?: string[];
}

const TARGETS: Target[] = [
  {
    provider: 'openrouter',
    url: 'https://openrouter.ai/docs/api-reference/authentication',
    scrollY: 240,
    hideSelectors: ['#cookie-banner', '[role="dialog"]'],
  },
  {
    provider: 'elevenlabs',
    url: 'https://elevenlabs.io/docs/api-reference/authentication',
    scrollY: 200,
    hideSelectors: ['#onetrust-banner-sdk', '[aria-label="Cookie banner"]'],
  },
  {
    provider: 'd-id',
    url: 'https://docs.d-id.com/reference/authentication',
    scrollY: 180,
    hideSelectors: ['[class*="cookie"]', '[class*="banner"]'],
  },
];

const OUT_DIR = path.resolve(__dirname, '../public/byok-guide');
const WIDTH = 960;
const HEIGHT = 320;

async function captureOne(browser: Browser, target: Target): Promise<void> {
  const ctx = await browser.newContext({
    viewport: { width: WIDTH, height: 900 },
    deviceScaleFactor: 2,
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  console.log(`[capture] ${target.provider} → ${target.url}`);
  try {
    await page.goto(target.url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch (err) {
    console.warn(`  ⚠ Slow load, retrying with domcontentloaded: ${(err as Error).message}`);
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
  }

  for (const sel of target.hideSelectors ?? []) {
    await page.evaluate((s) => {
      document.querySelectorAll(s).forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
    }, sel);
  }

  if (target.scrollY) {
    await page.evaluate((y) => window.scrollTo(0, y), target.scrollY);
    await page.waitForTimeout(300);
  }

  const outPath = path.join(OUT_DIR, `${target.provider}.png`);
  await page.screenshot({
    path: outPath,
    clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
    type: 'png',
  });
  console.log(`  ✓ wrote ${outPath}`);

  await ctx.close();
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  try {
    for (const t of TARGETS) {
      try {
        await captureOne(browser, t);
      } catch (err) {
        console.error(`  ✗ ${t.provider} failed: ${(err as Error).message}`);
        console.error(`    Skipping — replace public/byok-guide/${t.provider}.png with a manual capture.`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log('\nDone. Inspect output:');
  console.log(`  open ${OUT_DIR}`);
  console.log('\nIf any image looks wrong, replace it with a manual 960x320 screenshot');
  console.log('from your own dashboard (recommended for the production handoff).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
