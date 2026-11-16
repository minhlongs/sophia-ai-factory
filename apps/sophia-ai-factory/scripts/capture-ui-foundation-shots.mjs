#!/usr/bin/env node
/**
 * Captures UI-foundation reference screenshots so that token-layer changes can be
 * compared before and after without guessing.
 *
 * Usage: node scripts/capture-ui-foundation-shots.mjs <before|after> [baseUrl]
 */
import { mkdir, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

/**
 * The pinned Playwright build may be absent while a newer one is cached. Rather than
 * downloading a browser, fall back to any cached headless shell that exists.
 */
async function resolveExecutablePath() {
  const cacheRoot = path.join(homedir(), 'Library', 'Caches', 'ms-playwright');
  const suffix = 'chrome-headless-shell-mac-arm64/chrome-headless-shell';

  try {
    const candidates = (await readdir(cacheRoot))
      .filter((entry) => entry.startsWith('chromium_headless_shell-'))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));

    for (const candidate of candidates) {
      const executable = path.join(cacheRoot, candidate, suffix);
      try {
        await readdir(path.dirname(executable));
        return executable;
      } catch {
        continue;
      }
    }
  } catch {
    return undefined;
  }

  return undefined;
}

const label = process.argv[2];
const baseUrl = process.argv[3] ?? 'http://127.0.0.1:3000';

if (!label) {
  console.error('usage: node scripts/capture-ui-foundation-shots.mjs <label> [baseUrl]');
  process.exit(1);
}

// Public routes only. Auth-gated routes (dashboard, setup-wizard) redirect to /login
// without a session, so they are out of reach for a cookie-less capture.
const ROUTES = ['/vi', '/en', '/vi/pricing', '/vi/login', '/vi/features'];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const outDir = path.join(process.cwd(), 'reports', 'ui-foundation', label);
await mkdir(outDir, { recursive: true });

const executablePath = await resolveExecutablePath();
if (executablePath) console.log(`using cached browser: ${executablePath}`);

const browser = await chromium.launch({ executablePath });
const results = [];

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: 'reduce',
    colorScheme: 'dark',
    deviceScaleFactor: 1,
  });

  for (const route of ROUTES) {
    const page = await context.newPage();
    const slug = `${route.replace(/^\//, '').replace(/\//g, '_') || 'root'}-${viewport.name}.png`;
    const file = path.join(outDir, slug);

    try {
      const response = await page.goto(`${baseUrl}${route}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      // Let fonts, hydration and entry animations settle to a stable frame.
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: file, fullPage: true });

      const darkClass = await page.evaluate(() => document.documentElement.className);
      const bodyBg = await page.evaluate(
        () => getComputedStyle(document.body).backgroundColor,
      );

      results.push({ route, viewport: viewport.name, status: response?.status(), file, darkClass, bodyBg });
      console.log(`ok   ${route} ${viewport.name} status=${response?.status()} bg=${bodyBg}`);
    } catch (error) {
      results.push({ route, viewport: viewport.name, error: String(error.message ?? error) });
      console.error(`fail ${route} ${viewport.name}: ${error.message ?? error}`);
    } finally {
      await page.close();
    }
  }

  await context.close();
}

await browser.close();

const failed = results.filter((r) => r.error);
console.log(`\ncaptured ${results.length - failed.length}/${results.length} -> ${outDir}`);
if (failed.length > 0) process.exitCode = 1;
