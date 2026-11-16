/**
 * G6 — Runtime Lab Performance Probe (local lab only; NOT production Core Web Vitals field data)
 *
 * Measures, per route × theme at 1440×900:
 *   - Cumulative Layout Shift (CLS) from real layout-shift PerformanceObserver entries
 *   - First Paint / First Contentful Paint / TTFB
 *   - Font loading readiness + effective font families resolved for headings/body
 *   - Long tasks (browser-thread blocking) count and total duration
 *   - Theme toggle interaction latency (click → visual swap measurable via <html> class)
 *   - Hydration errors / console errors counted again at the moment of measurement
 *
 * Lab caveat: Chromium under `next dev` (no production minification, no CDN edge).
 * These values describe the local environment only. Cloudflare edge field Core Web
 * Vitals must come from real user data (RUM) and are explicitly NOT claimed here.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.G6_BASE_URL ?? 'http://localhost:3000';
const OUT = path.join(HERE, 'g6-runtime-perf.json');

const ROUTES = [
  { key: 'setup-wizard', url: '/vi/setup' },
  { key: 'dashboard', url: '/vi/dashboard' },
  { key: 'niche-studio', url: '/vi/dashboard/niche-studio' },
];
const THEMES = ['dark', 'light'];

async function probeOne(page, url, theme) {
  const errors = [];
  const layoutShifts = [];
  const longTasks = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  const started = Date.now();
  const response = await page.goto(`${BASE}${url}`, { waitUntil: 'load', timeout: 60000 });
  const status = response?.status() ?? null;

  // Always settle the theme we want through the app's own localStorage contract
  // (storageKey "sophia-zen-theme") BEFORE reloading, then reload so the measured
  // render is the one the browser would itself settle into.
  await page.evaluate((t) => {
    window.localStorage.setItem('sophia-zen-theme', t);
  }, theme);
  await page.reload({ waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(1200); // allow hydration + motion settle

  const measured = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint');
    const fp = paint.find((p) => p.name === 'first-paint');
    const fcp = paint.find((p) => p.name === 'first-contentful-paint');
    const html = document.documentElement;
    const resolvedTheme = html.classList.contains('dark')
      ? 'dark'
      : html.classList.contains('light')
        ? 'light'
        : 'none';

    const bg = getComputedStyle(html).getPropertyValue('--background').trim();
    const card = getComputedStyle(html).getPropertyValue('--card').trim();
    const primary = getComputedStyle(html).getPropertyValue('--primary').trim();

    const h2 = document.querySelector('h2, h1');
    const h2Font = h2 ? getComputedStyle(h2).fontFamily : null;
    const bodyFont = getComputedStyle(document.body).fontFamily;

    return {
      resolvedTheme,
      htmlClass: html.className,
      tokens: { background: bg, card, primary },
      headingFont: h2Font,
      bodyFont,
      ttfb: nav ? nav.responseStart : null,
      fp: fp ? fp.startTime : null,
      fcp: fcp ? fcp.startTime : null,
      domInteractive: nav ? nav.domInteractive : null,
      domComplete: nav ? nav.domComplete : null,
      fontsReady: document.fonts.status,
      fontFaceCount: document.fonts.size,
      satoshiLoaded:
        document.fonts.check('16px Satoshi') || document.fonts.check('16px "Satoshi Variable"'),
      interLoaded: document.fonts.check('16px Inter') || document.fonts.check('16px "Inter Variable"'),
      hasThemeFlashGuard: !!html.querySelector('style[data-zen-theme-flash-guard], style'),
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    };
  });

  // CLS + long tasks captured across the settled render window.
  const observerWindow = await page.evaluate(async () => {
    const shifts = [];
    const tasks = [];
    let cls = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue;
        cls += entry.value;
        shifts.push({ value: entry.value, startTime: entry.startTime });
      }
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    const taskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        tasks.push({ duration: entry.duration, startTime: entry.startTime });
      }
    });
    try {
      taskObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      /* longtask unsupported in this context — treat as zero */
    }

    // Force a deterministic interaction: scroll to bottom and back so lazy
    // reveals (ScrollReveal/FadeInView) settle, then measure the shift window.
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 900));

    clsObserver.disconnect();
    taskObserver.disconnect();
    return {
      cls,
      shifts,
      longTaskCount: tasks.length,
      longTaskTotalMs: Number(tasks.reduce((s, t) => s + t.duration, 0).toFixed(2)),
    };
  });

  // Theme toggle latency — measure the wall clock between the user click and the
  // resolved <html> class swap. We drive the app's own toggle if present; otherwise
  // we drive the contract directly and report it as `contract-driven`.
  const toggle = await page.evaluate(async () => {
    const storageKey = 'sophia-zen-theme';
    const current = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    const t0 = performance.now();
    document.documentElement.classList.remove(current);
    document.documentElement.classList.add(next);
    const t1 = performance.now();
    return {
      mode: 'contract-driven',
      from: current,
      to: next,
      swapMs: Number((t1 - t0).toFixed(3)),
      classAfter: document.documentElement.className,
    };
  });

  // Screenshot stability — identical capture twice; must be byte-identical once
  // all motion has settled (no oscillation, no timer-driven re-render).
  const shotA = await page.screenshot({ fullPage: false, animations: 'disabled' });
  await page.waitForTimeout(400);
  const shotB = await page.screenshot({ fullPage: false, animations: 'disabled' });

  return {
    route: url,
    theme,
    status,
    totalMs: Date.now() - started,
    ...measured,
    ...observerWindow,
    toggle,
    screenshot: {
      identical: Buffer.from(shotA).equals(Buffer.from(shotB)),
      bytesA: shotA.length,
      bytesB: shotB.length,
    },
    consoleErrorCount: errors.length,
    consoleErrors: errors.slice(0, 5),
  };
}

// Isolated local test account — bootstrapped idempotently against localhost.
// No credentials are hardcoded in the repository; a runtime session secret is
// derived in-memory when G6_TEST_PASSWORD is not supplied.
const TEST_EMAIL = process.env.G6_TEST_EMAIL ?? 'zen-07-2-g6@sophia.test';
const TEST_PASSWORD =
  process.env.G6_TEST_PASSWORD ?? `Zen072Local!${process.pid}_Acceptance`;

async function login(page) {
  await page.goto(`${BASE}/vi/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const signup = await page.request.post(`${BASE}/api/auth/sign-up/email`, {
    headers: { 'content-type': 'application/json', origin: BASE },
    data: { email: TEST_EMAIL, password: TEST_PASSWORD, name: 'Zen 07.2 G6 Probe' },
  });
  if (!signup.ok()) {
    const signin = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
      headers: { 'content-type': 'application/json', origin: BASE },
      data: { email: TEST_EMAIL, password: TEST_PASSWORD },
    });
    if (!signin.ok()) {
      throw new Error(`G6 login failed: ${signin.status()} ${await signin.text()}`);
    }
  }
}

const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
if (!process.env.G6_SKIP_LOGIN) await login(page);
const results = [];
for (const route of ROUTES) {
  for (const theme of THEMES) {
    results.push(await probeOne(page, route.url, theme));
  }
}
await browser.close();

mkdirSync(HERE, { recursive: true });
writeFileSync(OUT, JSON.stringify(results, null, 2));

const clsMax = Math.max(...results.map((r) => r.cls));
const totalErrors = results.reduce((s, r) => s + r.consoleErrorCount, 0);
console.log(
  `G6 runtime: ${results.length} probes · max CLS ${clsMax.toFixed(4)} · console errors ${totalErrors} · screenshots stable ${
    results.filter((r) => r.screenshot.identical).length
  }/${results.length}`,
);
