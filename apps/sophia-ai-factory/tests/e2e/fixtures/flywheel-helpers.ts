/**
 * flywheel-helpers.ts — Shared helpers for Creative Mission flywheel E2E tests.
 *
 * Extracted from creative-mission-flywheel.spec.ts to keep the spec under 200 lines.
 * Provides: mission payload builder, auth-guard helper, bilingual page check.
 */

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

// ── Mission payload builder ─────────────────────────────────────────────────

export function buildMissionPayload(workspaceId: string) {
  return {
    workspaceId,
    title: 'E2E Flywheel Test — AI Agent Campaign',
    objective: 'Generate 3 short-form videos and distribute to Telegram + YouTube',
    audience: 'Vietnamese CEOs aged 30-50',
    geography: 'Vietnam',
    timeframeStart: Math.floor(Date.now() / 1000),
    timeframeEnd: Math.floor(Date.now() / 1000) + 86400 * 7,
    budgetCents: 5000,
    autonomyLevel: 2,
    channels: ['telegram', 'youtube'],
    monetizationGoals: ['affiliate_clicks', 'video_views'],
    constraints: {},
    successMetrics: { views: 1000, clicks: 50 },
  };
}

// ── Auth guard ──────────────────────────────────────────────────────────────

/**
 * Check if the current page URL indicates the user was redirected to login.
 * If so, skip the test with a clear reason.
 *
 * Returns true if auth is valid (test should continue), false if skipped.
 */
export async function requireAuth(page: Page): Promise<boolean> {
  const url = page.url();
  if (url.match(/login|sign/i)) {
    test.skip(
      true,
      'Auth cookie invalid — session expired or password not set; manual run needed',
    );
    return false;
  }
  return true;
}

// ── Workspace fetch ─────────────────────────────────────────────────────────

export interface WorkspaceInfo {
  workspaceId?: string;
  orgId?: string;
}

/**
 * Fetch the current user's workspace ID via /api/user/workspace.
 * Returns null if unavailable.
 */
export async function fetchWorkspace(page: Page): Promise<WorkspaceInfo | null> {
  return page.evaluate(async () => {
    const res = await fetch('/api/user/workspace', { credentials: 'include' });
    if (!res.ok) return null;
    return res.json() as Promise<WorkspaceInfo | null>;
  });
}

// ── Bilingual page check ────────────────────────────────────────────────────

/**
 * Verify a page renders without JS errors in a given locale.
 * Returns true if page rendered cleanly, false if auth failed.
 */
export async function checkBilingualRender(
  page: Page,
  locale: 'vi' | 'en',
  path: string,
): Promise<boolean> {
  await page.goto(`/${locale}${path}`, { waitUntil: 'networkidle' });
  if (page.url().match(/login|sign/i)) {
    test.skip(true, `Auth cookie invalid — cannot test ${locale} locale on ${path}`);
    return false;
  }
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.waitForTimeout(300);
  await expect(page.locator('body')).toBeVisible();
  expect(errors).toHaveLength(0);
  return true;
}