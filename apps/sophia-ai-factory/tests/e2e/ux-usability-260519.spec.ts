/**
 * ux-usability-260519.spec.ts
 *
 * Real-user UX usability audit on Sophia AI Factory.
 * Targets PRODUCTION: https://sophia.agencyos.network
 *
 * Auth: uses `signIn()` from `./fixtures/auth-helpers` — proper CSRF-aware
 * Playwright request context with cookie jar. Replaces the broken inline
 * `bootstrapBasicUser()` that used raw `fetch()` — losing CSRF cookies —
 * causing silent failure (user=null → all flows skip).
 *
 * Output: screenshots → plans/reports/screenshots/ux-usability-260519/
 *
 * Run:
 *   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
 *   npx playwright test tests/e2e/ux-usability-260519.spec.ts \
 *     --headed --workers=1 --reporter=list
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { signIn } from './fixtures/auth-helpers'
import * as path from 'path'
import * as fs from 'fs'
import { fileURLToPath } from 'url'

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../plans/reports/screenshots/ux-usability-260519',
)

const LOCALE = 'en'

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(): void {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

function shot(slug: string): string {
  return path.join(SCREENSHOT_DIR, `${slug}.png`)
}

async function snap(page: Page, slug: string): Promise<void> {
  ensureDir()
  await page.screenshot({ path: shot(slug), fullPage: true })
}

interface InteractionResult {
  url: string
  visibleHeading: string
  hasContent: boolean
  brokenButtons: string[]
  errorBoundary: boolean
  loadingStuck: boolean
}

async function probePage(page: Page, slug: string): Promise<InteractionResult> {
  // Don't wait for networkidle — Sophia has long-lived analytics/SSE streams
  await page.waitForTimeout(1_500)
  await snap(page, slug)

  const h1 = await page.locator('h1').first().textContent().catch(() => null)
  const h2 = await page.locator('h2').first().textContent().catch(() => null)
  const visibleHeading = (h1 ?? h2 ?? '').trim().slice(0, 80)

  const bodyText = await page.locator('body').innerText().catch(() => '')
  const hasContent = bodyText.trim().length > 100

  const brokenButtons: string[] = []
  const buttons = await page.locator('button:not([disabled])').all().catch(() => [])
  for (const btn of buttons.slice(0, 30)) {
    const label = (await btn.textContent().catch(() => '')) ?? ''
    const trimmed = label.trim().slice(0, 60)
    if (!trimmed) continue
    if (/^(submit|save|create|upload|export|generate|refresh|connect|verify)\b/i.test(trimmed)) {
      brokenButtons.push(trimmed)
    }
  }

  const lowerBody = bodyText.toLowerCase()
  const errorBoundary =
    lowerBody.includes('something went wrong') ||
    lowerBody.includes('an error occurred') ||
    lowerBody.includes('try again')

  const loadingStuck =
    bodyText.trim().length < 100 ||
    (lowerBody.includes('loading...') && bodyText.trim().length < 200)

  return { url: page.url(), visibleHeading, hasContent, brokenButtons, errorBoundary, loadingStuck }
}

async function attachCookies(context: BrowserContext, cookies: Array<{ name: string; value: string; domain: string }>): Promise<void> {
  await context.addCookies(cookies)
}

// ── Auth bootstrap (replaces broken inline bootstrapBasicUser) ────────────────
//
// The old `bootstrapBasicUser()` used raw `fetch()` without a cookie jar —
// CSRF cookie set during GET /api/auth/sign-in was lost when the POST
// /api/auth/sign-in/email fired, so Better Auth rejected the request
// (no CSRF match). `signIn()` from `auth-helpers.ts` uses Playwright's
// request context (which has a cookie jar), handles CSRF extraction,
// and returns properly-signed cookies that the server accepts.

interface TestUser {
  email: string
  cookies: Array<{ name: string; value: string; domain: string; path: string; secure?: boolean; httpOnly: boolean; sameSite: 'Lax' | 'Strict' | 'None' }>
}

async function getTestUser(baseURL: string): Promise<TestUser | null> {
  const email = process.env.E2E_TEST_USER_EMAIL ?? process.env.E2E_ADMIN_EMAIL ?? ''
  const password =
    process.env.E2E_TEST_USER_EMAIL
      ? process.env.E2E_TEST_USER_PASSWORD
      : process.env.E2E_ADMIN_PASSWORD ?? ''

  if (!password) {
    console.warn('[ux-audit] No E2E password set — run `npm run e2e:bootstrap-user`')
    return null
  }

  try {
    const result = await signIn({ baseURL, email, password })
    const hostname = new URL(baseURL).hostname
    const cookieName = baseURL.startsWith('https://')
      ? '__Secure-better-auth.session_token'
      : 'better-auth.session_token'

    const sessionCookie = result.cookies.find(
      (c) => c.name === cookieName || c.name === 'better-auth.session_token',
    )

    return {
      email,
      cookies: [
        {
          name: sessionCookie?.name ?? cookieName,
          value: sessionCookie?.value ?? '',
          domain: hostname,
          path: '/',
          secure: baseURL.startsWith('https://'),
          httpOnly: true,
          sameSite: 'Lax' as const,
        },
      ],
    }
  } catch (err) {
    console.error(`[ux-audit] Auth bootstrap failed: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe('UX usability audit — BASIC + MASTER perspectives', () => {
  let user: TestUser | null = null
  let masterMagicLink: string | null = null

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'https://sophia.agencyos.network'
    user = await getTestUser(baseURL)
    if (user) {
      // Try FREE100 redeem for MASTER perspective
      try {
        const resp = await fetch(`${baseURL}/api/promo/redeem-free`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: baseURL },
          body: JSON.stringify({ code: 'FREE100', email: user.email, fullName: 'UX Auditor', locale: 'en', tier: 'MASTER' }),
        })
        if (resp.ok) {
          const json = (await resp.json().catch(() => null)) as { magicLink?: string } | null
          masterMagicLink = json?.magicLink ?? null
        }
      } catch { /* rate-limited or unavailable — non-fatal */ }
      console.log(`[ux-audit] BASIC user: ${user.email}, FREE100 magic link: ${masterMagicLink ? 'GOT' : 'NONE'}`)
    }
  })

  // ── Flow 1: signup → dashboard ──────────────────────────────────────────

  test('Flow 1: signup → first dashboard impression', async ({ page, baseURL }) => {
    test.setTimeout(90_000)
    const url = baseURL ?? 'https://sophia.agencyos.network'

    await page.goto(`${url}/${LOCALE}/auth/signup`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      .catch(() => page.goto(`${url}/${LOCALE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 }))
    await snap(page, '01-signup-or-login-page')

    const emailField = page.locator('input[type="email"], input[name="email"]').first()
    const passwordField = page.locator('input[type="password"], input[name="password"]').first()
    const emailVisible = await emailField.isVisible().catch(() => false)
    const passwordVisible = await passwordField.isVisible().catch(() => false)
    console.log(`[ux-audit][signup] email visible: ${emailVisible}, password: ${passwordVisible}`)

    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    await attachCookies(page.context(), user.cookies)

    await page.goto(`${url}/${LOCALE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const probe = await probePage(page, '02-dashboard-first-impression')
    console.log(`[ux-audit][dashboard-first] heading="${probe.visibleHeading}" content=${probe.hasContent} url=${probe.url}`)

    expect(probe.url, 'should not bounce to login').not.toMatch(/\/login/)
    expect(probe.hasContent, 'dashboard should render content').toBe(true)
  })

  // ── Flow 2: Setup Wizard ────────────────────────────────────────────────

  test('Flow 2: Setup Wizard step-through', async ({ page, baseURL }) => {
    test.setTimeout(120_000)
    if (!user) { test.skip(true, 'bootstrap failed'); return }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user.cookies)

    await page.goto(`${url}/${LOCALE}/setup-wizard`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    let probe = await probePage(page, '03-wizard-step-1')
    console.log(`[ux-audit][wizard step1] heading="${probe.visibleHeading}" content=${probe.hasContent}`)

    const firstInput = page.locator('input:not([type=hidden])').first()
    if (await firstInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await firstInput.click().catch(() => {})
      await firstInput.fill('sk-test-not-real-key-uxaudit-12345').catch(() => {})
      await snap(page, '04-wizard-input-filled')
    }

    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Tiếp"), a:has-text("Next")').first()
    if (await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await nextBtn.click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      probe = await probePage(page, '05-wizard-step-2')
      console.log(`[ux-audit][wizard step2] heading="${probe.visibleHeading}"`)
    } else {
      console.log(`[ux-audit][wizard] no Next/Continue button found`)
    }

    await page.goto(`${url}/${LOCALE}/dashboard/onboarding`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await probePage(page, '06-onboarding-page')
  })

  // ── Flow 3: Dashboard nav coverage ──────────────────────────────────────

  test('Flow 3: dashboard HTTP probe — all routes', async ({ baseURL, request }) => {
    test.setTimeout(60_000)
    if (!user) { test.skip(true, 'bootstrap failed'); return }
    const url = baseURL ?? 'https://sophia.agencyos.network'

    const seedLinks = [
      '/dashboard', '/dashboard/create', '/dashboard/campaigns', '/dashboard/analytics',
      '/dashboard/voices', '/dashboard/templates', '/dashboard/orders', '/dashboard/help',
      '/dashboard/missions', '/dashboard/credits', '/dashboard/integrations',
      '/dashboard/integrations/webhooks', '/dashboard/byok', '/dashboard/api-keys',
      '/dashboard/proposals', '/dashboard/workflows', '/dashboard/sop-marketplace',
      '/dashboard/sops', '/dashboard/api-docs', '/dashboard/account',
      '/dashboard/settings', '/dashboard/support', '/dashboard/affiliate',
      '/dashboard/onboarding', '/dashboard/admin', '/dashboard/system-health',
      '/dashboard/billing', '/dashboard/wallet',
    ]
    const uniqueHrefs = Array.from(new Set(seedLinks))
    const httpStatuses: Record<string, number | string> = {}
    for (const href of uniqueHrefs) {
      try {
        const resp = await request.get(`${url}${href}`, { timeout: 10_000 })
        httpStatuses[href] = resp.status()
      } catch (err) {
        httpStatuses[href] = `ERR:${(err as Error).message.slice(0, 50)}`
      }
    }
    console.log('[ux-audit][nav][http-probe]')
    for (const [h, s] of Object.entries(httpStatuses)) {
      console.log(` ${h} → HTTP ${s}`)
    }
    const failures = Object.entries(httpStatuses).filter(([, s]) => typeof s === 'number' && (s >= 400 || s < 200))
    expect(failures, `routes with non-2xx: ${JSON.stringify(failures)}`).toHaveLength(0)
  })

  // ── Per-route renderer probes ────────────────────────────────────────────

  const RENDER_ROUTES: Array<[string, string]> = [
    ['/dashboard/create', '09-create-page'],
    ['/dashboard/campaigns', '10-campaigns-page'],
    ['/dashboard/analytics', '11-analytics-page'],
    ['/dashboard/voices', '12-voices-page'],
    ['/dashboard/templates', '13-templates-page'],
    ['/dashboard/orders', '14-orders-page'],
    ['/dashboard/help', '15-help-page'],
    ['/dashboard/missions', '16-missions-page'],
    ['/dashboard/integrations', '17-integrations-page'],
    ['/dashboard/byok', '18-byok-page'],
    ['/dashboard/api-keys', '19-api-keys-page'],
    ['/dashboard/proposals', '20a-proposals-page'],
    ['/dashboard/workflows', '21a-workflows-page'],
    ['/dashboard/sop-marketplace', '22-sop-marketplace-page'],
    ['/dashboard/sops', '23-sops-page'],
    ['/dashboard/api-docs', '24-api-docs-page'],
    ['/dashboard/account', '25-account-page'],
    ['/dashboard/settings', '26-settings-page'],
    ['/dashboard/support', '27-support-page'],
    ['/dashboard/system-health', '28-system-health-page'],
    ['/dashboard/billing', '29-billing-page'],
    ['/dashboard/wallet', '30-wallet-page'],
  ]

  for (const [route, slug] of RENDER_ROUTES) {
    test(`Renderer probe: ${route}`, async ({ page, baseURL }) => {
      test.setTimeout(90_000)
      if (!user) { test.skip(true, 'bootstrap failed'); return }
      const url = baseURL ?? 'https://sophia.agencyos.network'
      await attachCookies(page.context(), user.cookies)

      let crashed = false
      page.on('crash', () => { crashed = true })

      try {
        await page.goto(`${url}${route}`, { waitUntil: 'domcontentloaded', timeout: 12_000 })
        await page.waitForLoadState('load', { timeout: 4_000 }).catch(() => {})
        const probe = await probePage(page, slug)
        const flag = probe.errorBoundary ? '⚠ error-boundary' : probe.loadingStuck ? '⚠ stuck-loading' : !probe.hasContent ? '⚠ empty' : 'ok'
        console.log(`[ux-audit][render] ${route} → ${flag} | "${probe.visibleHeading}"`)
      } catch (err) {
        const msg = (err as Error).message.slice(0, 100)
        console.log(`[ux-audit][render] ${route} → FAILED${crashed ? ' (renderer crash)' : ''}: ${msg}`)
      }
    })
  }

  // ── Flow 4: Affiliate ───────────────────────────────────────────────────

  test('Flow 4: /dashboard/affiliate — interactive probe', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!user) { test.skip(true, 'bootstrap failed'); return }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user.cookies)

    await page.goto(`${url}/${LOCALE}/dashboard/affiliate`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const probe = await probePage(page, '20-affiliate-landing')
    console.log(`[ux-audit][affiliate] heading="${probe.visibleHeading}" content=${probe.hasContent}`)

    const payoutLink = page.locator('a:has-text("Payout"), button:has-text("Payout"), a[href*="payout"]').first()
    if (await payoutLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await payoutLink.click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      await probePage(page, '21-affiliate-payouts')
      console.log(`[ux-audit][affiliate] payouts → ${page.url()}`)
    } else {
      console.log(`[ux-audit][affiliate] no Payout link visible`)
    }

    await page.goto(`${url}/${LOCALE}/dashboard/affiliate`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const exportBtn = page.locator('button:has-text("Export"), a:has-text("Export")').first()
    if (await exportBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      console.log(`[ux-audit][affiliate] Export ${await exportBtn.evaluate((el) => el.tagName).catch(() => 'UNKNOWN')} present`)
      await snap(page, '22-affiliate-export-visible')
    } else {
      console.log(`[ux-audit][affiliate] no Export button`)
    }
  })

  // ── Flow 5: Credits / Billing ───────────────────────────────────────────

  test('Flow 5: /dashboard/credits — billing surface', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!user) { test.skip(true, 'bootstrap failed'); return }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user.cookies)

    await page.goto(`${url}/${LOCALE}/dashboard/credits`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const probe = await probePage(page, '30-credits-landing')
    console.log(`[ux-audit][credits] heading="${probe.visibleHeading}" content=${probe.hasContent}`)

    const buyBtn = page.locator('button:has-text("Buy"), button:has-text("Top up"), button:has-text("Purchase"), a:has-text("Buy")').first()
    if (await buyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await buyBtn.click().catch(() => {})
      await page.waitForTimeout(2_000)
      await snap(page, '31-credits-buy-clicked')
      console.log(`[ux-audit][credits] after Buy → ${page.url()}`)
    } else {
      console.log(`[ux-audit][credits] no Buy CTA`)
    }
  })

  // ── Flow 6: Admin gate ──────────────────────────────────────────────────

  test('Flow 6: /dashboard/admin — BASIC user gate', async ({ page, baseURL }) => {
    test.setTimeout(30_000)
    if (!user) { test.skip(true, 'bootstrap failed'); return }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user.cookies)

    await page.goto(`${url}/${LOCALE}/dashboard/admin`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const probe = await probePage(page, '40-admin-gate-basic-user')
    const redirected = !probe.url.includes('/dashboard/admin')
    console.log(`[ux-audit][admin-gate] redirected=${redirected} → ${probe.url}`)

    expect(probe.hasContent, 'admin gate destination should have content').toBe(true)
  })

  // ── Flow 7: MASTER perspective ──────────────────────────────────────────

  test('Flow 7: MASTER perspective via magic link', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!masterMagicLink) {
      test.skip(true, 'FREE100 redeem did not return a magic link — skipping MASTER flow')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'

    await page.goto(masterMagicLink, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await snap(page, '50-master-magic-link-landing')

    await page.goto(`${url}/${LOCALE}/dashboard/admin`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const probe = await probePage(page, '51-master-admin-page')
    console.log(`[ux-audit][master-admin] url=${probe.url} heading="${probe.visibleHeading}"`)
  })

  // ── Flow 8: Responsive sweep ────────────────────────────────────────────

  test('Flow 8: responsive — mobile / tablet / desktop on /dashboard', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!user) { test.skip(true, 'bootstrap failed'); return }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user.cookies)

    for (const [w, h, label] of [
      [375, 812, 'mobile-375'],
      [768, 1024, 'tablet-768'],
      [1024, 768, 'desktop-1024'],
    ] as Array<[number, number, string]>) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`${url}/${LOCALE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await snap(page, `60-responsive-${label}`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      console.log(`[ux-audit][responsive] ${label} → horizontal overflow=${overflow}px`)
    }
  })
})
