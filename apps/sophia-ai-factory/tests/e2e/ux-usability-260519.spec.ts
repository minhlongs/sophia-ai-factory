/**
 * ux-usability-260519.spec.ts
 *
 * Real-user UX usability audit on Sophia AI Factory.
 * Targets PRODUCTION: https://sophia.agencyos.network
 *
 * What this spec does (vs the prior console-error bug-hunt):
 *   - Drives the dashboard like a non-tech CEO would: clicks, fills, navigates.
 *   - Captures screenshots of every meaningful interaction.
 *   - Documents:
 *       * blocked CTAs (buttons that do nothing / pages that 404 from sidebar)
 *       * missing empty states
 *       * unresponsive layouts (375 / 768 / 1024)
 *       * accessibility gaps (labels, alt, focus order — sampled)
 *
 * Auth strategy:
 *   - Bootstrap a fresh BASIC-tier user via /api/auth/sign-up/email.
 *   - Try a FREE100 redeem for the same email — if it returns a magicLink,
 *     visit the link to upgrade the same session to MASTER. If redeem is
 *     unavailable in prod, MASTER flows are documented as "blocked-by-fixture".
 *
 * Output:
 *   - Screenshots → plans/reports/screenshots/ux-usability-260519/
 *
 * Run:
 *   PLAYWRIGHT_TEST_BASE_URL=https://sophia.agencyos.network \
 *   npx playwright test tests/e2e/ux-usability-260519.spec.ts \
 *     --headed --workers=1 --reporter=list
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// ── Constants ────────────────────────────────────────────────────────────────

const SCREENSHOT_DIR = path.resolve(
  __dirname,
  '../../plans/reports/screenshots/ux-usability-260519',
)

const LOCALE = 'en'

// ── Helpers ──────────────────────────────────────────────────────────────────

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

interface BootstrappedUser {
  email: string
  password: string
  baseURL: string
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

/** Sign up a fresh user against production Better Auth. */
async function bootstrapBasicUser(baseURL: string): Promise<BootstrappedUser> {
  const timestamp = Date.now()
  const email = `uxaudit-${timestamp}@sophia.test`
  const password = `UxAudit${timestamp}!!`

  const isSecure = baseURL.startsWith('https://')

  const signupResp = await fetch(`${baseURL}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseURL },
    body: JSON.stringify({ email, password, name: 'UX Auditor' }),
  })
  if (!signupResp.ok) {
    const body = await signupResp.text().catch(() => '')
    throw new Error(`signup failed: HTTP ${signupResp.status} — ${body.slice(0, 200)}`)
  }

  const signinResp = await fetch(`${baseURL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: baseURL },
    body: JSON.stringify({ email, password }),
    redirect: 'manual',
  })
  if (!signinResp.ok && signinResp.status !== 302) {
    const body = await signinResp.text().catch(() => '')
    throw new Error(`signin failed: HTTP ${signinResp.status} — ${body.slice(0, 200)}`)
  }

  let sessionToken = ''
  const rawHeaders = signinResp.headers as unknown as { getSetCookie?: () => string[] }
  const setCookies: string[] =
    typeof rawHeaders.getSetCookie === 'function'
      ? rawHeaders.getSetCookie()
      : [signinResp.headers.get('set-cookie') ?? '']
  for (const header of setCookies) {
    const match = header.match(/(?:__Secure-)?better-auth\.session_token=([^;]+)/)
    if (match) {
      sessionToken = decodeURIComponent(match[1])
      break
    }
  }
  if (!sessionToken) {
    const bodyJson = (await signinResp.json().catch(() => null)) as { token?: string } | null
    if (bodyJson?.token) sessionToken = bodyJson.token
  }
  if (!sessionToken) {
    throw new Error(`no session cookie. Set-Cookie: ${setCookies.join(' | ').slice(0, 300)}`)
  }

  const domain = new URL(baseURL).hostname
  const cookieName = isSecure
    ? '__Secure-better-auth.session_token'
    : 'better-auth.session_token'

  return {
    email,
    password,
    baseURL,
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

/** Attempt FREE100 redeem; returns null if unavailable. */
async function tryRedeemFree100(baseURL: string, email: string): Promise<string | null> {
  try {
    const resp = await fetch(`${baseURL}/api/promo/redeem-free`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: baseURL },
      body: JSON.stringify({
        code: 'FREE100',
        email,
        fullName: 'UX Auditor',
        locale: 'en',
        tier: 'MASTER',
      }),
    })
    if (!resp.ok) return null
    const json = (await resp.json().catch(() => null)) as { magicLink?: string } | null
    return json?.magicLink ?? null
  } catch {
    return null
  }
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
  // that never settle. Just give the page 1s to render visible content.
  await page.waitForTimeout(1_500)
  await snap(page, slug)

  // Visible primary heading
  const h1 = await page.locator('h1').first().textContent().catch(() => null)
  const h2 = await page.locator('h2').first().textContent().catch(() => null)
  const visibleHeading = (h1 ?? h2 ?? '').trim().slice(0, 80)

  // Body has more than skeleton/loading content?
  const bodyText = await page.locator('body').innerText().catch(() => '')
  const hasContent = bodyText.trim().length > 100

  // Buttons that have no href, no onClick listener, no aria-disabled but appear "primary"
  // (rough heuristic — full check would need DOM listener inspection)
  const brokenButtons: string[] = []
  const buttons = await page.locator('button:not([disabled])').all().catch(() => [])
  for (const btn of buttons.slice(0, 30)) {
    const label = (await btn.textContent().catch(() => '')) ?? ''
    const trimmed = label.trim().slice(0, 60)
    if (!trimmed) continue
    // Only flag suspicious — buttons with action verbs but no apparent target
    const isSuspicious = /^(submit|save|create|upload|export|generate|refresh|connect|verify)\b/i.test(trimmed)
    if (isSuspicious) {
      // can't truly test "does nothing on click" non-destructively here
      // but we can record label for manual review
      brokenButtons.push(trimmed)
    }
  }

  // Error boundary text
  const errorBoundary =
    bodyText.toLowerCase().includes('something went wrong') ||
    bodyText.toLowerCase().includes('an error occurred') ||
    bodyText.toLowerCase().includes('try again')

  // Loading skeleton stuck?
  const loadingStuck =
    bodyText.trim().length < 100 ||
    bodyText.toLowerCase().includes('loading...') && bodyText.trim().length < 200

  return {
    url: page.url(),
    visibleHeading,
    hasContent,
    brokenButtons,
    errorBoundary,
    loadingStuck,
  }
}

async function attachCookies(context: BrowserContext, user: BootstrappedUser): Promise<void> {
  await context.addCookies(user.cookies)
}

// ── Test suite ───────────────────────────────────────────────────────────────

// NOTE: NOT serial — each flow seeds its own auth cookies and is independent.
// Serial-mode causes a single hung navigation to cascade and skip later flows.

test.describe('UX usability audit — BASIC + MASTER perspectives', () => {
  let user: BootstrappedUser | null = null
  let masterMagicLink: string | null = null

  test.beforeAll(async ({}, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? 'https://sophia.agencyos.network'
    try {
      user = await bootstrapBasicUser(baseURL)
      console.log(`[ux-audit] BASIC user: ${user.email}`)
    } catch (err) {
      console.error(`[ux-audit] bootstrap failed: ${err}`)
      user = null
    }
    if (user) {
      masterMagicLink = await tryRedeemFree100(baseURL, user.email)
      console.log(`[ux-audit] FREE100 magic link: ${masterMagicLink ? 'GOT' : 'NONE'}`)
    }
  })

  // ── Flow 1: signup → dashboard ──────────────────────────────────────────

  test('Flow 1: signup → first dashboard impression', async ({ page, baseURL }) => {
    test.setTimeout(90_000)
    const url = baseURL ?? 'https://sophia.agencyos.network'

    // 1a) Visit signup page anonymously and screenshot
    await page.goto(`${url}/${LOCALE}/auth/signup`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      .catch(() => page.goto(`${url}/${LOCALE}/login`, { waitUntil: 'domcontentloaded', timeout: 30_000 }))
    await snap(page, '01-signup-or-login-page')

    // Probe: are email + password fields visible and labelled?
    const emailField = page.locator('input[type="email"], input[name="email"]').first()
    const passwordField = page.locator('input[type="password"], input[name="password"]').first()
    const emailVisible = await emailField.isVisible().catch(() => false)
    const passwordVisible = await passwordField.isVisible().catch(() => false)
    console.log(`[ux-audit][signup] email field visible: ${emailVisible}, password: ${passwordVisible}`)

    if (emailVisible) {
      const ariaLabel = await emailField.getAttribute('aria-label').catch(() => null)
      const placeholder = await emailField.getAttribute('placeholder').catch(() => null)
      const linkedLabel = await page.locator('label[for]').first().textContent().catch(() => null)
      console.log(`[ux-audit][signup] email a11y: aria-label="${ariaLabel}" placeholder="${placeholder}" label="${linkedLabel?.trim()}"`)
    }

    // 1b) Now switch to authenticated context (we already created the user via API)
    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    await attachCookies(page.context(), user)

    // 1c) First landing — /dashboard
    await page.goto(`${url}/${LOCALE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const probe = await probePage(page, '02-dashboard-first-impression')
    console.log(`[ux-audit][dashboard-first] heading="${probe.visibleHeading}" content=${probe.hasContent} url=${probe.url}`)

    expect(probe.url, 'should not bounce to login').not.toMatch(/\/login/)
    expect(probe.hasContent, 'dashboard should render content').toBe(true)
  })

  // ── Flow 2: Setup Wizard ────────────────────────────────────────────────

  test('Flow 2: Setup Wizard step-through', async ({ page, baseURL }) => {
    test.setTimeout(120_000)
    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user)

    // Try canonical setup-wizard route
    await page.goto(`${url}/${LOCALE}/setup-wizard`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    let probe = await probePage(page, '03-wizard-step-1')
    console.log(`[ux-audit][wizard step1] heading="${probe.visibleHeading}" content=${probe.hasContent}`)

    // Try filling in any visible input as a smoke test
    const firstInput = page.locator('input:not([type=hidden])').first()
    const inputVisible = await firstInput.isVisible({ timeout: 2_000 }).catch(() => false)
    if (inputVisible) {
      await firstInput.click().catch(() => {})
      await firstInput.fill('sk-test-not-real-key-uxaudit-12345').catch(() => {})
      await snap(page, '04-wizard-input-filled')
    }

    // Look for a Next / Continue button
    const nextBtn = page.locator(
      'button:has-text("Next"), button:has-text("Continue"), button:has-text("Tiếp"), a:has-text("Next")'
    ).first()
    const nextVisible = await nextBtn.isVisible({ timeout: 2_000 }).catch(() => false)
    if (nextVisible) {
      await nextBtn.click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      probe = await probePage(page, '05-wizard-step-2')
      console.log(`[ux-audit][wizard step2] heading="${probe.visibleHeading}"`)
    } else {
      console.log(`[ux-audit][wizard] no Next/Continue button found`)
    }

    // Also probe /dashboard/onboarding (alternate wizard)
    await page.goto(`${url}/${LOCALE}/dashboard/onboarding`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await probePage(page, '06-onboarding-page')
  })

  // ── Flow 3: Dashboard nav coverage ──────────────────────────────────────

  test('Flow 3: dashboard HTTP probe — all routes', async ({ baseURL, request }) => {
    test.setTimeout(60_000)
    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'

    // HTTP probe of every dashboard route discovered by hand-curation.
    // (Renderer probes happen in dedicated per-route tests below to avoid the
    // renderer-crash cascade we observed in /dashboard/create + /dashboard/campaigns.)
    const seedLinks = [
      '/dashboard',
      '/dashboard/create',
      '/dashboard/campaigns',
      '/dashboard/analytics',
      '/dashboard/voices',
      '/dashboard/templates',
      '/dashboard/orders',
      '/dashboard/help',
      '/dashboard/missions',
      '/dashboard/credits',
      '/dashboard/integrations',
      '/dashboard/integrations/webhooks',
      '/dashboard/byok',
      '/dashboard/api-keys',
      '/dashboard/proposals',
      '/dashboard/workflows',
      '/dashboard/sop-marketplace',
      '/dashboard/sops',
      '/dashboard/api-docs',
      '/dashboard/account',
      '/dashboard/settings',
      '/dashboard/support',
      '/dashboard/affiliate',
      '/dashboard/onboarding',
      '/dashboard/admin',
      '/dashboard/system-health',
      '/dashboard/billing',
      '/dashboard/wallet',
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
      console.log(`  ${h} → HTTP ${s}`)
    }
    // Every dashboard route should respond with 200 (not 404, not 5xx)
    const failures = Object.entries(httpStatuses).filter(
      ([, s]) => typeof s === 'number' && (s >= 400 || s < 200),
    )
    expect(failures, `routes with non-2xx: ${JSON.stringify(failures)}`).toHaveLength(0)
  })

  // ── Per-route renderer probes — one test per route so a renderer crash
  //    on route X doesn't poison routes Y, Z, ... (Playwright gives each test
  //    a fresh `page` from its own context/process so crashes are isolated.)

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
      test.setTimeout(30_000)
      if (!user) {
        test.skip(true, 'bootstrap failed')
        return
      }
      const url = baseURL ?? 'https://sophia.agencyos.network'
      await attachCookies(page.context(), user)

      let crashed = false
      page.on('crash', () => {
        crashed = true
      })

      try {
        await page.goto(`${url}${route}`, { waitUntil: 'domcontentloaded', timeout: 12_000 })
        await page.waitForLoadState('load', { timeout: 4_000 }).catch(() => {})
        const probe = await probePage(page, slug)
        const flag = probe.errorBoundary
          ? '⚠ error-boundary'
          : probe.loadingStuck
          ? '⚠ stuck-loading'
          : !probe.hasContent
          ? '⚠ empty'
          : 'ok'
        console.log(`[ux-audit][render] ${route} → ${flag} | "${probe.visibleHeading}"`)
        // Don't fail the test on stuck/empty — those are findings we want to record.
      } catch (err) {
        const msg = (err as Error).message.slice(0, 100)
        console.log(`[ux-audit][render] ${route} → FAILED${crashed ? ' (renderer crash)' : ''}: ${msg}`)
      }
    })
  }

  // ── Flow 4: Affiliate ───────────────────────────────────────────────────

  test('Flow 4: /dashboard/affiliate — interactive probe', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user)

    await page.goto(`${url}/${LOCALE}/dashboard/affiliate`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const probe = await probePage(page, '20-affiliate-landing')
    console.log(`[ux-audit][affiliate] heading="${probe.visibleHeading}" content=${probe.hasContent}`)

    // Click "Payout methods" if present
    const payoutLink = page.locator(
      'a:has-text("Payout"), button:has-text("Payout"), a[href*="payout"]'
    ).first()
    if (await payoutLink.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await payoutLink.click().catch(() => {})
      await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {})
      await probePage(page, '21-affiliate-payouts')
      console.log(`[ux-audit][affiliate] payouts → ${page.url()}`)
    } else {
      console.log(`[ux-audit][affiliate] no Payout link visible`)
    }

    // Try Export CSV
    await page.goto(`${url}/${LOCALE}/dashboard/affiliate`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const exportBtn = page.locator('button:has-text("Export"), a:has-text("Export")').first()
    if (await exportBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Don't actually trigger download — just check if it has handler
      const tag = await exportBtn.evaluate((el) => el.tagName).catch(() => 'UNKNOWN')
      console.log(`[ux-audit][affiliate] Export ${tag} present`)
      await snap(page, '22-affiliate-export-visible')
    } else {
      console.log(`[ux-audit][affiliate] no Export button`)
    }
  })

  // ── Flow 5: Credits / Billing ───────────────────────────────────────────

  test('Flow 5: /dashboard/credits — billing surface', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user)

    await page.goto(`${url}/${LOCALE}/dashboard/credits`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const probe = await probePage(page, '30-credits-landing')
    console.log(`[ux-audit][credits] heading="${probe.visibleHeading}" content=${probe.hasContent}`)

    // Look for a "Buy" / "Top up" / "Purchase" CTA
    const buyBtn = page.locator(
      'button:has-text("Buy"), button:has-text("Top up"), button:has-text("Purchase"), a:has-text("Buy")'
    ).first()
    if (await buyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await buyBtn.click().catch(() => {})
      await page.waitForTimeout(2_000) // allow modal/redirect
      await snap(page, '31-credits-buy-clicked')
      console.log(`[ux-audit][credits] after Buy → ${page.url()}`)
    } else {
      console.log(`[ux-audit][credits] no Buy CTA`)
    }
  })

  // ── Flow 6: Admin gate ──────────────────────────────────────────────────

  test('Flow 6: /dashboard/admin — BASIC user gate', async ({ page, baseURL }) => {
    test.setTimeout(30_000)
    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user)

    await page.goto(`${url}/${LOCALE}/dashboard/admin`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const probe = await probePage(page, '40-admin-gate-basic-user')
    const redirected = !probe.url.includes('/dashboard/admin')
    console.log(`[ux-audit][admin-gate] redirected=${redirected} → ${probe.url}`)

    // If redirected — check that landing is helpful (not blank)
    expect(probe.hasContent, 'admin gate destination should have content').toBe(true)
  })

  // ── Flow 7: MASTER perspective (if FREE100 redeem worked) ───────────────

  test('Flow 7: MASTER perspective via magic link', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!masterMagicLink) {
      test.skip(true, 'FREE100 redeem did not return a magic link — skipping MASTER flow')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'

    // Visit the magic link — establishes MASTER session
    await page.goto(masterMagicLink, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await snap(page, '50-master-magic-link-landing')

    // Then probe /dashboard/admin which should now be accessible
    await page.goto(`${url}/${LOCALE}/dashboard/admin`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
    const probe = await probePage(page, '51-master-admin-page')
    console.log(`[ux-audit][master-admin] url=${probe.url} heading="${probe.visibleHeading}"`)
  })

  // ── Flow 8: Responsive sweep ────────────────────────────────────────────

  test('Flow 8: responsive — mobile / tablet / desktop on /dashboard', async ({ page, baseURL }) => {
    test.setTimeout(60_000)
    if (!user) {
      test.skip(true, 'bootstrap failed')
      return
    }
    const url = baseURL ?? 'https://sophia.agencyos.network'
    await attachCookies(page.context(), user)

    for (const [w, h, label] of [
      [375, 812, 'mobile-375'],
      [768, 1024, 'tablet-768'],
      [1024, 768, 'desktop-1024'],
    ] as Array<[number, number, string]>) {
      await page.setViewportSize({ width: w, height: h })
      await page.goto(`${url}/${LOCALE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 20_000 })
      await snap(page, `60-responsive-${label}`)
      // Horizontal scroll? (basic check — bodyWidth vs viewportWidth)
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - document.documentElement.clientWidth
      })
      console.log(`[ux-audit][responsive] ${label} → horizontal overflow=${overflow}px`)
    }
  })
})
