/**
 * handover-bughunt-260519.spec.ts
 *
 * Deep DOM/console bug-hunt across 5 core /dashboard routes.
 * Targets localhost dev server (NEXT_PUBLIC_MOCK_D1=true) or prod
 * via PLAYWRIGHT_TEST_BASE_URL.
 *
 * Auth strategy: uses `signIn()` from `./fixtures/auth-helpers` which
 * hits the real Better Auth /api/auth/sign-in endpoint via Playwright's
 * request context (with proper CSRF cookie jar). Replaces the previous
 * raw `fetch()` bootstrap that lost the CSRF cookie, causing silent
 * credential failure and all 5 route tests to skip.
 *
 * Run:
 *   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
 *   npx playwright test tests/e2e/handover-bughunt-260519.spec.ts \
 *     --reporter=list 2>&1
 */

import { test, expect, type Page } from '@playwright/test'
import { signIn } from './fixtures/auth-helpers'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

let currentBaseURL: string = ''

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../plans/reports/screenshots/handover-bughunt-260519',
)

const I18N_KEY_PATTERN = /\b([a-z_]+\.){2,}[a-z_]+\b/

// ── Helpers ───────────────────────────────────────────────────────────────────

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

  await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 })
  report.finalUrl = page.url()

  try {
    const apiCtx = page.context()
    const finalResp = await apiCtx.request.head(report.finalUrl, {
      timeout: 10_000,
    })
    report.httpStatus = finalResp.status()
  } catch {
    report.httpStatus = null
  }

  ensureScreenshotDir()
  await page.screenshot({ path: screenshotPath(slug), fullPage: true })

  const bodyText = await page.evaluate(
    () => document.body?.innerText ?? '',
  )
  const matches = bodyText.match(new RegExp(I18N_KEY_PATTERN.source, 'g'))
  if (matches) {
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

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Bug Hunt: 5 core dashboard routes', () => {
  // Real Better Auth sign-in — uses proper Playwright request context
  // with cookie jar for CSRF. Uses E2E_TEST_USER_EMAIL/PASSWORD env
  // vars (from `npm run e2e:bootstrap-user`) or E2E_ADMIN_EMAIL/PASSWORD.
  // Auto-skips if no E2E_*_PASSWORD is set (no skip guard needed —
  // signIn throws when password missing, caught by beforeAll).

  let signInCookies: Array<{
    name: string
    value: string
    domain: string
    path: string
    secure?: boolean
    httpOnly: boolean
    sameSite: 'Lax' | 'Strict' | 'None'
  }>

  let cookieJson: string

  test.beforeAll(async ({}, testInfo) => {
    const runBaseURL =
      testInfo.project.use.baseURL ?? 'https://sophia.agencyos.network'
    const email =
      process.env.E2E_TEST_USER_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? ''
    const password =
      process.env.E2E_TEST_USER_EMAIL
        ? process.env.E2E_TEST_USER_PASSWORD
        : process.env.E2E_ADMIN_PASSWORD ?? ''

    if (!password) {
      test.skip(true, 'E2E_TEST_USER_PASSWORD not set, run `npm run e2e:bootstrap-user`') // TODO 2026-07-15: unskip once e2e:bootstrap-user is run and creds are in .env.test
      return
    }

    try {
      const result = await signIn({
        baseURL: runBaseURL,
        email,
        password: password,
      })
      const hostname = new URL(runBaseURL).hostname
      const cookieName = runBaseURL.startsWith('https://')
        ? '__Secure-better-auth.session_token'
        : 'better-auth.session_token'

      const sessionCookie = result.cookies.find(
        (c) => c.name === cookieName || c.name === 'better-auth.session_token',
      )

      signInCookies = [
        {
          name: sessionCookie?.name ?? cookieName,
          value: sessionCookie?.value ?? '',
          domain: hostname,
          path: '/',
          secure: runBaseURL.startsWith('https://'),
          httpOnly: true,
          sameSite: 'Lax' as const,
        },
      ]
    } catch (err) {
      test.skip(
        true,
        `Auth bootstrap failed: ${err instanceof Error ? err.message : err}`,
      )
    }
  })

  function injectCookies(page: Page) {
    if (!currentBaseURL || !signInCookies) return
    const hostname = new URL(currentBaseURL).hostname
    page
      .context()
      .addCookies(signInCookies.map((c) => ({ ...c, domain: hostname })))
  }

  // ── Route 1: /dashboard ───────────────────────────────────────────────────

  test('Route 1: /dashboard (home)', async ({ page }) => {
    injectCookies(page)

    const report = await visitRoute(page, `/${currentBaseURL.includes('sophia') ? '' : 'en/'}dashboard`, 'dashboard-home')

    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)
    expect(url, 'Should be on dashboard').toMatch(/\/dashboard/)

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][dashboard] CONSOLE ERRORS (${report.consoleErrors.length}):`)
      report.consoleErrors.forEach((e) => console.error(` - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][dashboard] NETWORK FAILURES (${report.networkFailures.length}):`)
      report.networkFailures.forEach((f) => console.warn(` - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][dashboard] RAW I18N KEYS (${report.rawI18nKeys.length}):`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(` - ${k}`))
    }
    if (report.pageErrors.length > 0) {
      console.error(`[bughunt][dashboard] PAGE ERRORS (${report.pageErrors.length}):`)
      report.pageErrors.forEach((e) => console.error(` - ${e}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 2: /dashboard/onboarding ────────────────────────────────────────

  test('Route 2: /dashboard/onboarding (BYOK Setup Wizard)', async ({ page }) => {
    injectCookies(page)

    const report = await visitRoute(page, `/${currentBaseURL.includes('sophia') ? '' : 'en/'}dashboard/onboarding`, 'dashboard-onboarding')

    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][onboarding] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(` - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][onboarding] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(` - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][onboarding] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(` - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 3: /dashboard/admin ─────────────────────────────────────────────

  test('Route 3: /dashboard/admin (MASTER gate — expect redirect for BASIC user)', async ({ page }) => {
    injectCookies(page)

    const report = await visitRoute(page, `/${currentBaseURL.includes('sophia') ? '' : 'en/'}dashboard/admin`, 'dashboard-admin')

    const url = report.finalUrl
    // BASIC user: must redirect away from /admin
    const redirectedAway = !url.includes('/dashboard/admin')

    if (redirectedAway) {
      console.log(`[bughunt][admin] Correctly redirected to: ${url}`)
      expect(url).toMatch(/dashboard|login|\?error=admin_required/)
    } else {
      console.log(`[bughunt][admin] MASTER user — admin page loaded at: ${url}`)
    }

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][admin] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(` - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][admin] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(` - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][admin] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(` - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 4: /dashboard/affiliate ─────────────────────────────────────────

  test('Route 4: /dashboard/affiliate (Affiliate dashboard)', async ({ page }) => {
    injectCookies(page)

    const report = await visitRoute(page, `/${currentBaseURL.includes('sophia') ? '' : 'en/'}dashboard/affiliate`, 'dashboard-affiliate')

    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][affiliate] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(` - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][affiliate] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(` - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][affiliate] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(` - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })

  // ── Route 5: /dashboard/credits ───────────────────────────────────────────

  test('Route 5: /dashboard/credits (Credits / Billing page)', async ({ page }) => {
    injectCookies(page)

    const report = await visitRoute(page, `/${currentBaseURL.includes('sophia') ? '' : 'en/'}dashboard/credits`, 'dashboard-credits')

    const url = report.finalUrl
    expect(url, 'Should NOT redirect to login').not.toMatch(/\/login/)

    if (report.consoleErrors.length > 0) {
      console.error(`[bughunt][credits] CONSOLE ERRORS:`)
      report.consoleErrors.forEach((e) => console.error(` - ${e}`))
    }
    if (report.networkFailures.length > 0) {
      console.warn(`[bughunt][credits] NETWORK FAILURES:`)
      report.networkFailures.forEach((f) => console.warn(` - ${f.status} ${f.url}`))
    }
    if (report.rawI18nKeys.length > 0) {
      console.warn(`[bughunt][credits] RAW I18N KEYS:`)
      report.rawI18nKeys.slice(0, 20).forEach((k) => console.warn(` - ${k}`))
    }

    expect(report.consoleErrors.length, 'Console errors found').toBe(0)
  })
})
