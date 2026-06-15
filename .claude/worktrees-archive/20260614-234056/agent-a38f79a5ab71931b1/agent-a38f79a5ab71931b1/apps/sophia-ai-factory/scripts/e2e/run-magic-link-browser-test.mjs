/**
 * run-magic-link-browser-test.mjs
 * Phase 02 E2E — drive real Chrome through magic-link → setup-wizard flow on PROD.
 *
 * Usage: node scripts/e2e/run-magic-link-browser-test.mjs <magic-link-url>
 * Output: JSON to stdout with verdict, cookies, finalUrl, statusChain.
 *         Screenshot saved on FAIL to plans/260503-0830-sophia-magic-link-e2e-validation/reports/
 *
 * Requires: puppeteer (available in ~/.claude/skills/chrome-devtools/scripts/node_modules/)
 */

import { createRequire } from 'module';
import { tmpdir } from 'os';
import { mkdtempSync, mkdirSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve puppeteer from skill node_modules (skill ships it) or local fallback
const SKILL_MODULES = join(
  process.env.HOME || process.env.USERPROFILE || '',
  '.claude/skills/chrome-devtools/scripts/node_modules',
);

const require = createRequire(import.meta.url);
let puppeteer;
try {
  // Try local project first, then skill directory
  puppeteer = require(join(SKILL_MODULES, 'puppeteer'));
} catch {
  puppeteer = (await import('puppeteer')).default;
}

const MAGIC_LINK_URL = process.argv[2];
if (!MAGIC_LINK_URL) {
  console.error('Usage: node run-magic-link-browser-test.mjs <magic-link-url>');
  process.exit(1);
}

const REPORTS_DIR = resolve(
  __dirname,
  '../../../../plans/260503-0830-sophia-magic-link-e2e-validation/reports',
);

const TIMEOUT_MS = 20_000;

/** @typedef {{ name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite?: string; expires: number }} PuppeteerCookie */

/**
 * @typedef {{ verdict: 'PASS' | 'FAIL'; finalUrl: string; cookies: PuppeteerCookie[]; statusChain: Array<{url: string; status: number}>; screenshot?: string; error?: string }} TestResult
 */

async function run() {
  const userDataDir = mkdtempSync(join(tmpdir(), 'sophia-e2e-'));

  /** @type {Array<{url: string; status: number}>} */
  const statusChain = [];
  /** @type {string | undefined} */
  let screenshotPath;
  /** @type {string} */
  let finalUrl = MAGIC_LINK_URL;

  const browser = await puppeteer.launch({
    headless: true,
    userDataDir,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  try {
    const page = await browser.newPage();

    // Set realistic UA + viewport
    await page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    );
    await page.setViewport({ width: 1280, height: 800 });

    // Capture all response statuses + Set-Cookie from validate endpoint
    page.on('response', (response) => {
      const url = response.url();
      const status = response.status();
      statusChain.push({ url, status });
      if (url.includes('/api/welcome/validate/')) {
        const setCookieHeader = response.headers()['set-cookie'];
        if (setCookieHeader) {
          console.error(`[E2E] Set-Cookie from validate: ${setCookieHeader.substring(0, 120)}...`);
        } else {
          console.error('[E2E] WARNING: no Set-Cookie header on validate response');
        }
      }
    });

    // Navigate to magic-link — welcome-page-client shows onboarding page, then user clicks "Get Started"
    console.error(`[E2E] Navigating to: ${MAGIC_LINK_URL}`);
    await page.goto(MAGIC_LINK_URL, { waitUntil: 'networkidle0', timeout: TIMEOUT_MS });

    // Wait for the welcome page to load (GET validates token and shows data)
    // Then click the "Get Started" / "Bắt đầu ngay" button which triggers POST
    try {
      console.error('[E2E] Waiting for Get Started button...');
      // Button text is "Bắt đầu ngay" (vi) or "Get Started" (en)
      await page.waitForFunction(
        () => {
          const btns = Array.from(document.querySelectorAll('button'));
          return btns.some((b) =>
            b.textContent?.includes('Bắt đầu ngay') ||
            b.textContent?.includes('Get Started'),
          );
        },
        { timeout: 10_000 },
      );
      console.error('[E2E] Clicking Get Started...');
      // Click via evaluate to avoid strict mode selector issues
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find((b) =>
          b.textContent?.includes('Bắt đầu ngay') ||
          b.textContent?.includes('Get Started'),
        );
        if (btn) /** @type {HTMLButtonElement} */ (btn).click();
      });
    } catch (btnErr) {
      console.error('[E2E] Could not find/click Get Started button:', btnErr);
    }

    // Wait for POST → redirect to /setup-wizard (window.location.href is set by handleGetStarted)
    try {
      await page.waitForFunction(
        () => window.location.pathname.includes('/setup-wizard'),
        { timeout: TIMEOUT_MS },
      );
      // Wait for page to fully load after redirect
      await page.waitForNetworkIdle({ timeout: 8_000 }).catch(() => {});
    } catch {
      // Not on setup-wizard — capture final URL for diagnosis
      finalUrl = page.url();
      console.error(`[E2E] Redirect did NOT land on /setup-wizard — final URL: ${finalUrl}`);
    }

    finalUrl = page.url();
    const cookies = await page.cookies();

    // Check for session cookie
    const sessionCookie = cookies.find((c) =>
      c.name === '__Secure-better-auth.session_token' ||
      c.name === 'better-auth.session_token',
    );

    // Check for setup-wizard form selector
    const hasWizardRoot = await page.$('[data-testid="setup-wizard-root"]') !== null;
    const hasWizardFallback = await page.$('h1, [class*="wizard"]') !== null;

    const onSetupWizard = finalUrl.includes('/setup-wizard');
    const hasSessionCookie = Boolean(sessionCookie);
    const wizardRendered = hasWizardRoot || hasWizardFallback;

    const verdict = onSetupWizard && hasSessionCookie && wizardRendered ? 'PASS' : 'FAIL';

    if (verdict === 'FAIL') {
      // Save screenshot for Phase 04 evidence
      mkdirSync(REPORTS_DIR, { recursive: true });
      screenshotPath = join(REPORTS_DIR, `fail-screenshot-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.error(`[E2E] Screenshot saved to: ${screenshotPath}`);
    }

    /** @type {TestResult} */
    const result = {
      verdict,
      finalUrl,
      cookies: cookies.map((c) => ({
        name: c.name,
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        secure: c.secure,
        sameSite: c.sameSite,
        expires: c.expires,
        // value omitted intentionally — session token is sensitive
        value: c.name.includes('session_token') ? '[REDACTED]' : c.value,
      })),
      statusChain,
      onSetupWizard,
      hasSessionCookie,
      sessionCookieName: sessionCookie?.name ?? null,
      wizardRendered,
      ...(screenshotPath ? { screenshot: screenshotPath } : {}),
    };

    return result;
  } finally {
    await browser.close();
  }
}

run()
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.verdict === 'PASS' ? 0 : 1);
  })
  .catch((err) => {
    console.error('[E2E] Fatal error:', err);
    /** @type {TestResult} */
    const result = {
      verdict: 'FAIL',
      finalUrl: MAGIC_LINK_URL,
      cookies: [],
      statusChain: [],
      error: err instanceof Error ? err.message : String(err),
    };
    console.log(JSON.stringify(result, null, 2));
    process.exit(1);
  });
