/**
 * Playwright a11y fixture — wraps `@axe-core/playwright` with WCAG 2.1 AA defaults.
 * Throws on `serious|critical` violations by default; `minor|moderate` reported but not failing.
 *
 * Usage:
 *   import { test, expect } from '../_fixtures/a11y-test'
 *
 *   test('admin page has no a11y violations', async ({ page, checkA11y }) => {
 *     await page.goto('/dashboard/admin')
 *     await checkA11y(page)
 *   })
 *
 *   // Suppress a known design-required rule for a single scan:
 *   await checkA11y(page, { disabledRules: ['color-contrast'] })
 */

import { test as base, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

export type Severity = 'minor' | 'moderate' | 'serious' | 'critical'

export interface CheckA11yOptions {
  /** CSS selectors to scope the scan to specific regions */
  include?: string[]
  /** CSS selectors to exclude from the scan */
  exclude?: string[]
  /** Axe rule IDs to skip (e.g. 'color-contrast' for known design tokens) */
  disabledRules?: string[]
  /** Impact levels that should fail the test (default: serious + critical) */
  failOn?: Severity[]
}

export interface A11yFixtures {
  checkA11y: (page: Page, opts?: CheckA11yOptions) => Promise<void>
}

export const test = base.extend<A11yFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture API requires destructured first arg
  checkA11y: async ({}, use) => {
    await use(async (page, opts = {}) => {
      const failOn: Severity[] = opts.failOn ?? ['serious', 'critical']

      let builder = new AxeBuilder({ page }).withTags([
        'wcag2a',
        'wcag2aa',
        'wcag21aa',
      ])

      if (opts.include) {
        for (const sel of opts.include) builder = builder.include(sel)
      }
      if (opts.exclude) {
        for (const sel of opts.exclude) builder = builder.exclude(sel)
      }
      if (opts.disabledRules?.length) {
        builder = builder.disableRules(opts.disabledRules)
      }

      const results = await builder.analyze()
      const failing = results.violations.filter((v) =>
        failOn.includes(v.impact as Severity),
      )

      if (failing.length > 0) {
        const lines = failing.map((v) => {
          const nodes = v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')
          return `  [${v.impact}] ${v.id}: ${v.description}\n    affected: ${v.nodes.length} node(s) — ${nodes}`
        })
        throw new Error(
          `A11y violations (${failOn.join('|')}) found on ${page.url()}:\n${lines.join('\n')}`,
        )
      }
    })
  },
})

export { expect }
