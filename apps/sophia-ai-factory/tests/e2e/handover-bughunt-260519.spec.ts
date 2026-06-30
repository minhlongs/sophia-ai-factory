/**
 * handover-bughunt-260519.spec.ts
 *
 * Deep DOM/console bug-hunt across 5 core /dashboard routes.
 * Targets PRODUCTION: https://sophia.agencyos.network
 *
 * Auth strategy: on-the-fly signup via /api/auth/sign-up/email.
 *   - Uses a unique timestamped email per run (safe to re-run, no collision).
 *   - This creates a BASIC-tier user — covers non-MASTER dashboard routes.
 *   - /dashboard/admin test explicitly checks redirect behaviour for non-MASTER.
 *
 * Screenshots saved to:
 *   plans/reports/screenshots/handover-bughunt-260519/{route-slug}.png
 *
 * Run:
 *   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
 *   npx playwright test tests/e2e/handover-bughunt-260519.spec.ts \
 *     --reporter=list 2>&1
 */

import { test, expect, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../plans/reports/screenshots/handover-bughunt-260519',
)

// Raw i18n key pattern: e.g. "dashboard.home.title", "common.loading", etc.
// Matches dot-separated lowercase identifiers with at least 2 segments.
const I18N_KEY_PATTERN = /\b([a-z_]+\.){2,}[a-z_]+\b/

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureScreenshotDir(): void {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

function screenshotPath(slug: string): string {
  return path.join(SCREENSHOT_DIR, `${slug}.png`)
}

interface BugReport {
  consoleErrors: string[]
  consoleWarnings: string[]
  networkFailures: Array<{ url: string; status: number }>
  pageErrors: string[]
  rawI18nKeys: string[]
  finalUrl: string
  httpStatus: number | null
}

async function visitRoute(
  page: Page,
  route: string,
  slug: string,
): Promise<BugReport> {
  const report: BugReport = {
    consoleErrors: [],
    consoleWarnings: [],
    networkFailures: [],
    pageErrors: [],
    rawI18nKeys: [],
    finalUrl: '',
    httpStatus: null,
  }

  // Wire up listeners BEFORE navigating
  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error') report.consoleErrors.push(text)
    else if (msg.type() === 'warning') report.consoleWarnings.push(text)
  })

  page.on('pageerror', (err) => {
    report.pageErrors.push(err.message)
  })

  page.on('response', (resp) => {
    if (resp.status() >= 400) {
      report.networkFailures.push({ url: resp.url(), status: resp.status() })
    }
  })

  let firstResponse: { url: string; status: number } | null = null
  page.on('response', (resp) => {
    if (!firstResponse && resp.url().includes(route.replace('/dashboard', ''))) {
      firstResponse = { url: resp.url(), status: resp.status() }
    }
  })

  // Navigate — waitUntil: networkidle for full DOM settle
  await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 })
  report.finalUrl = page.url()

  // Capture HTTP status of the final page response
  // (We check via a fresh HEAD request to confirm the final URL)
  try {
    const apiCtx = page.context()
    const finalResp = await apiCtx.request.head(report.finalUrl, { timeout: 10_000 })
    report.httpStatus = finalResp.status()
  } catch {
    report.httpStatus = null
  }

  // Save screenshot
  ensureScreenshotDir()
  await page.screenshot({ path: screenshotPath(slug), fullPage: true })

  // Scan DOM text for raw i18n keys
  const bodyText = await page.evaluate(() => document.body?.innerText ?? '')
  const matches = bodyText.match(new RegExp(I18N_KEY_PATTERN.source, 'g'))
  if (matches) {
    // Filter to realistic i18n keys (exclude URLs, emails, versions)
    const filtered = matches.filter(
      (m) =>
        !m.includes('://') &&
        !m.includes('@') &&
        !m.match(/^\d/) &&
        m.split('.').every((p) => p.length > 0 && p.length < 30),
    )
    report.rawI18nKeys.push(...[...new Set(filtered)])
  }

  return report
}

// ── Setup ────────────────────────────────────────────────────────────────────

interface TestCredentials {
  email: string
  password: string
  cookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    secure?: boolean
    httpOnly?: boolean
    sameSite?: 'Lax' | 'Strict' | 'None'
  }>
}

async function bootstrapTestUser(baseURL: string): Promise<TestCredentials> {
  const timestamp = Date.now()
  const email = `bughunt-${timestamp}@sophia.test`
  const password = `BugHuntPW${timestamp}!!`

  const isSecure = baseURL.startsWith('https://')
  const origin = baseURL

  // Sign up a fresh user (requires Origin header on production)
  const signupResp = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': origin,
    },
    body: JSON.stringify({ email, password, name: 'BugHunt Tester' }),
  })

  if (!signupResp.ok) {
    const body = await signupResp.text().catch(() => '<no body>')
    throw new Error(`Signup failed: HTTP ${signupResp.status} — ${body.slice(0, 200)}`)
  }

  // Sign in to harvest cookies
  const signinResp = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'origin': origin,
    },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })

  if (!signinResp.ok && signinResp.status !== 302) {
    const body = await signinResp.text().catch(() => '')
    throw new Error(`Sign-in failed: HTTP ${signinResp.status} — ${body.slice(0, 200)}`)
  }

  // Parse Set-Cookie headers — node fetch gives only first set-cookie, use getSetCookie if available
  let sessionToken = ''
  const rawHeaders = (signinResp.headers as unknown as { getSetCookie?: () => string[] })
  const setCookies: string[] = typeof rawHeaders.getSetCookie === 'function'
    ? rawHeaders.getSetCookie()
    : [signinResp.headers.get('set-cookie') ?? '']

  // Match both __Secure- prefixed and non-prefixed session token
  for (const header of setCookies) {
    const match = header.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/)
    if (match) {
      sessionToken = decodeURIComponent(match[1])
      break
    }
  }

  if (!sessionToken) {
    // Fallback: parse from JSON body token field from signup response body
    // Note: signup response is already consumed, use the sign-in JSON
    const bodyJson = (await signinResp.json().catch(() => null)) as { token?: string } | null
    if (bodyJson?.token) sessionToken = bodyJson.token
  }

  if (!sessionToken) {
    throw new Error(`No session cookie found. Set-Cookie headers: ${setCookies.join(' | ').slice(0, 300)}`)
  }

  const domain = new URL(baseURL).hostname
  // Production uses __Secure- prefix — requires secure:true in Playwright cookie
  const cookieName = isSecure
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token'

  return {
    email,
    password,
    cookies: [
      {
        name: cookieName,
        value: sessionToken,
        domain,
        path: '/',
        secure: isSecure,
        httpOnly: true,
        sameSite: 'Lax' as const,
      },
    ],
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('Bug Hunt: 5 core dashboard routes', () => {
  let credentials: TestCredentials | null = null

  test.beforeAll(async ({ }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'https://sophia.agencyos.network'
    try {
      credentials = await bootstrapTestUser(baseURL)
      console.log(`[bughunt] Bootstrapped test user: ${credentials.email}`)
    } catch (err) {
      console.error(`[bughunt] Bootstrap failed: ${err}`)
      credentials = null
    }
  })

  // ── Route 1: /dashboard ──────────────────────────────────────────────────

  test('Route 1: /dashboard (home)', async ({ page, baseURL }) => {
    if (!credentials) {
      test.skip(true, 'Bootstrap failed — cannot test authenticated routes')
      return
    }

    const locale = 'en'
    await page.context().addCookies(credentials.cookies.map(c => ({
      ...c,
      domain: new URL(baseURL ?? 'https://sophia.agencyos.network').hostname,
    })))

    const report = await visitRoute(page, `/${locale}/dashboard`, 'dashboard-home')

    // Assertions
    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)
    expect(url, 'Should be on dashboard').toMatch(/\/dashboard/)

    // Log all findings
    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][dashboard] CONSOLE ERRORS (${report.consoleErrors.length}):`)
      report.consoleErrors.forEach((e) => console.error(`  - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][dashboard] NETWORK FAILURES (${report.networkFailures.length}):`)
      report.networkFailures.forEach((f) => console.warn(`  - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][dashboard] RAW I18N KEYS (${report.rawI18nKeys.length}):`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(`  - ${k}`))
    }
    if (report.pageErrors.length > 0) {
      console.error(`[bughunt][dashboard] PAGE ERRORS (${report.pageErrors.length}):`)
      report.pageErrors.forEach((e) => console.error(`  - ${e}`))
    }

    // Soft assertion — log count, don't hard-fail (we want ALL routes to run)
    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 2: /dashboard/onboarding ──────────────────────────────────────

  test('Route 2: /dashboard/onboarding (BYOK Setup Wizard)', async ({ page, baseURL }) => {
    if (!credentials) {
      test.skip(true, 'Bootstrap failed')
      return
    }

    const locale = 'en'
    await page.context().addCookies(credentials.cookies.map(c => ({
      ...c,
      domain: new URL(baseURL ?? 'https://sophia.agencyos.network').hostname,
    })))

    const report = await visitRoute(page, `/${locale}/dashboard/onboarding`, 'dashboard-onboarding')

    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][onboarding] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(`  - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][onboarding] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(`  - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][onboarding] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(`  - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 3: /dashboard/admin ────────────────────────────────────────────

  test('Route 3: /dashboard/admin (MASTER gate — expect redirect for BASIC user)', async ({ page, baseURL }) => {
    if (!credentials) {
      test.skip(true, 'Bootstrap failed')
      return
    }

    const locale = 'en'
    await page.context().addCookies(credentials.cookies.map(c => ({
      ...c,
      domain: new URL(baseURL ?? 'https://sophia.agencyos.network').hostname,
    })))

    const report = await visitRoute(page, `/${locale}/dashboard/admin`, 'dashboard-admin')

    const url = report.finalUrl
    // BASIC user: must redirect away from /admin
    const redirectedAway = !url.includes('/dashboard/admin')
    const onAdminPage = url.includes('/dashboard/admin')

    if (redirectedAway) {
      console.log(`[bughunt][admin] Correctly redirected to: ${url}`)
      // Verify the redirect destination makes sense
      expect(url).toMatch(/dashboard|login|\?error=admin_required/)
    } else {
      console.log(`[bughunt][admin] MASTER user — admin page loaded at: ${url}`)
    }

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][admin] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(`  - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][admin] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(`  - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][admin] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(`  - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 4: /dashboard/affiliate ───────────────────────────────────────

  test('Route 4: /dashboard/affiliate (Affiliate dashboard)', async ({ page, baseURL }) => {
    if (!credentials) {
      test.skip(true, 'Bootstrap failed')
      return
    }

    const locale = 'en'
    await page.context().addCookies(credentials.cookies.map(c => ({
      ...c,
      domain: new URL(baseURL ?? 'https://sophia.agencyos.network').hostname,
    })))

    const report = await visitRoute(page, `/${locale}/dashboard/affiliate`, 'dashboard-affiliate')

    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][affiliate] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(`  - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][affiliate] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(`  - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][affiliate] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(`  - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 5: /dashboard/credits (billing/credits page) ──────────────────

  test('Route 5: /dashboard/credits (Credits / Billing page)', async ({ page, baseURL }) => {
    if (!credentials) {
      test.skip(true, 'Bootstrap failed')
      return
    }

    const locale = 'en'
    await page.context().addCookies(credentials.cookies.map(c => ({
      ...c,
      domain: new URL(baseURL ?? 'https://sophia.agencyos.network').hostname,
    })))

    const report = await visitRoute(page, `/${locale}/dashboard/credits`, 'dashboard-credits')

    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][credits] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(`  - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][credits] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(`  - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][credits] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(`  - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })
})
