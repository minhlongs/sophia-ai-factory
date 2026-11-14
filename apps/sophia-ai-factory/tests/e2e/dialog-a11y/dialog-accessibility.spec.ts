/**
 * Dialog accessibility — real-browser verification.
 *
 * Opens the dialogs that ship in the product through genuine user interaction
 * (trigger click, Cmd+K) and measures what the browser actually does:
 * initial focus, Tab/Shift+Tab containment, Escape, focus return, accessible
 * name and description, background inertness and dialog semantics — across
 * dark/light and vi/en.
 *
 * Requires the development server on the configured baseURL. The harness route
 * returns 404 in a production build, so this spec cannot run against one.
 */

import { test as base, expect, type Locator, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

const EVIDENCE_DIR = path.resolve(process.cwd(), 'docs/design/zen-design-os/evidence');
const REPORT_PATH = path.join(EVIDENCE_DIR, 'dialog-a11y-report.json');

interface DialogMeasurement {
  surface: string;
  locale: string;
  theme: string;
  openedBy: string;
  role: string | null;
  ariaModal: string | null;
  labelledBy: string | null;
  describedBy: string | null;
  accessibleName: string;
  accessibleDescription: string;
  initialFocus: string;
  initialFocusInsideDialog: boolean;
  tabContained: boolean;
  tabStops: number;
  shiftTabContained: boolean;
  escapeClosed: boolean;
  /**
   * `null` means the surface has no trigger element (a keyboard-opened palette),
   * so exact-identity focus return is not applicable. The observed target is
   * still recorded in `focusReturnTarget`.
   */
  focusReturnedToTrigger: boolean | null;
  focusReturnTarget: string;
  backgroundAriaHidden: boolean;
  backgroundPointerEvents: string;
  closeButtonAccessibleName: string;
}

/**
 * Measurements are persisted per test rather than once at the end: a worker is
 * recycled after a failure, which would otherwise discard everything measured
 * before the failure and leave an empty evidence file.
 */
function persistMeasurement(record: DialogMeasurement): void {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const existing = fs.existsSync(REPORT_PATH)
    ? (JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as { measurements?: DialogMeasurement[] })
    : {};
  const measurements = (existing.measurements ?? []).filter(
    (m) => !(m.surface === record.surface && m.locale === record.locale && m.theme === record.theme),
  );
  measurements.push(record);
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), measurements }, null, 2),
  );
}

const LOCALES = ['vi', 'en'] as const;
const THEMES = ['dark', 'light'] as const;

function describeElement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return 'body';
    const id = el.id ? `#${el.id}` : '';
    const testId = el.getAttribute('data-testid');
    const label = el.getAttribute('aria-label');
    const text = (el.innerText ?? '').trim().slice(0, 30);
    return `${el.tagName.toLowerCase()}${id}${testId ? `[${testId}]` : ''}${
      label ? `|aria:${label}` : text ? `|${text}` : ''
    }`;
  });
}

async function seedTheme(page: Page, theme: string): Promise<void> {
  await page.addInitScript((value: string) => {
    try {
      window.localStorage.setItem('sophia-zen-theme', value);
      window.localStorage.setItem(
        'sophia_consent_v1',
        JSON.stringify({
          necessary: true,
          analytics: false,
          marketing: false,
          version: 1,
          updatedAt: Date.now(),
        }),
      );
    } catch {
      // storage unavailable
    }
  }, theme);
}

async function measureDialog(
  page: Page,
  surface: string,
  locale: string,
  theme: string,
  openedBy: string,
  /** Omitted for surfaces opened by keyboard shortcut, which have no trigger. */
  trigger?: Locator,
) {
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  const semantics = await page.evaluate(() => {
    const node = document.querySelector('[role="dialog"]') as HTMLElement | null;
    if (!node) return null;
    const labelId = node.getAttribute('aria-labelledby');
    const descId = node.getAttribute('aria-describedby');
    const resolve = (id: string | null) =>
      id ? (document.getElementById(id)?.textContent ?? '').trim() : '';
    const closeBtn = node.querySelector('button');
    return {
      role: node.getAttribute('role'),
      ariaModal: node.getAttribute('aria-modal'),
      labelledBy: labelId,
      describedBy: descId,
      accessibleName: resolve(labelId),
      accessibleDescription: resolve(descId),
      closeButtonAccessibleName: (closeBtn?.textContent ?? '').trim(),
    };
  });

  expect(semantics).not.toBeNull();
  const s = semantics!;

  const initialFocus = await describeElement(page);
  const initialFocusInsideDialog = await page.evaluate(() => {
    const node = document.querySelector('[role="dialog"]');
    return !!node && !!document.activeElement && node.contains(document.activeElement);
  });

  // Tab containment: walk more stops than the dialog has focusables and
  // confirm focus never escapes.
  let tabContained = true;
  const seen = new Set<string>();
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    const inside = await page.evaluate(() => {
      const node = document.querySelector('[role="dialog"]');
      return !!node && !!document.activeElement && node.contains(document.activeElement);
    });
    if (!inside) tabContained = false;
    seen.add(await describeElement(page));
  }

  // Shift+Tab containment from wherever focus currently is.
  let shiftTabContained = true;
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Shift+Tab');
    const inside = await page.evaluate(() => {
      const node = document.querySelector('[role="dialog"]');
      return !!node && !!document.activeElement && node.contains(document.activeElement);
    });
    if (!inside) shiftTabContained = false;
  }

  const background = await page.evaluate(() => {
    const node = document.querySelector('[role="dialog"]');
    if (!node) return { hidden: false, pointerEvents: 'unknown' };
    // Radix implements modality by marking every root-level element that does
    // not contain the dialog as aria-hidden. It never sets aria-modal, so the
    // inert background is the property that actually blocks assistive tech.
    const hidden = Array.from(document.body.children).some(
      (el) => !el.contains(node) && el.getAttribute('aria-hidden') === 'true',
    );
    return {
      hidden,
      pointerEvents: window.getComputedStyle(document.body).pointerEvents,
    };
  });

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden({ timeout: 5000 });
  const escapeClosed = true;

  // Exact identity, not a heuristic: the very element that opened the dialog
  // must be the focused element again after it closes. A surface opened by
  // keyboard has no trigger to compare against, so it records `null`.
  const focusReturnTarget = await describeElement(page);
  let focusReturnedToTrigger: boolean | null = null;
  if (trigger) {
    try {
      await expect(trigger).toBeFocused({ timeout: 3000 });
      focusReturnedToTrigger = true;
    } catch {
      // Measured as false and reported below; never upgraded to a pass.
      focusReturnedToTrigger = false;
    }
  }

  const record: DialogMeasurement = {
    surface,
    locale,
    theme,
    openedBy,
    role: s.role,
    ariaModal: s.ariaModal,
    labelledBy: s.labelledBy,
    describedBy: s.describedBy,
    accessibleName: s.accessibleName,
    accessibleDescription: s.accessibleDescription,
    initialFocus,
    initialFocusInsideDialog,
    tabContained,
    tabStops: seen.size,
    shiftTabContained,
    escapeClosed,
    focusReturnedToTrigger,
    focusReturnTarget,
    backgroundAriaHidden: background.hidden,
    backgroundPointerEvents: background.pointerEvents,
    closeButtonAccessibleName: s.closeButtonAccessibleName,
  };
  persistMeasurement(record);
  return record;
}

const test = base;

test.describe('Dialog accessibility — real browser', () => {
  for (const locale of LOCALES) {
    for (const theme of THEMES) {
      test(`form dialog via trigger click — ${locale}/${theme}`, async ({ page }) => {
        await seedTheme(page, theme);
        await page.goto(`/${locale}/zen-a11y-harness`, { waitUntil: 'domcontentloaded' });

        const trigger = page.getByTestId('harness-dialog-trigger');
        await expect(trigger).toBeVisible();
        await trigger.click();

        const r = await measureDialog(page, 'harness-form-dialog', locale, theme, 'trigger-click', trigger);

        expect(r.role).toBe('dialog');
        // Radix implements modality by aria-hiding everything outside the
        // dialog rather than by setting aria-modal, so the recorded aria-modal
        // value is evidence, not a pass criterion. Assert the mechanism it
        // actually uses to block the background.
        expect(r.backgroundAriaHidden, 'background must be inert while the dialog is open').toBe(true);
        expect(r.accessibleName.length, 'dialog must have a non-empty accessible name').toBeGreaterThan(0);
        expect(
          r.accessibleDescription.length,
          'dialog must have a non-empty accessible description',
        ).toBeGreaterThan(0);
        expect(r.initialFocusInsideDialog, `initial focus was ${r.initialFocus}`).toBe(true);
        expect(r.tabContained, 'Tab must stay inside the dialog').toBe(true);
        expect(r.shiftTabContained, 'Shift+Tab must stay inside the dialog').toBe(true);
        expect(r.escapeClosed, 'Escape must close the dialog').toBe(true);
        expect(
          r.focusReturnedToTrigger,
          `focus returned to ${r.focusReturnTarget}`,
        ).toBe(true);
        expect(r.closeButtonAccessibleName.length, 'close button needs an accessible name').toBeGreaterThan(0);
        expect(r.backgroundPointerEvents, 'body must block background interaction').toBe('none');
      });

      test(`rotation dialog via production trigger — ${locale}/${theme}`, async ({ page }) => {
        await seedTheme(page, theme);
        await page.goto(`/${locale}/zen-a11y-harness`, { waitUntil: 'domcontentloaded' });

        const rotate = page.getByRole('button', { name: /Xoay Khóa Ngay|Rotate Now|Xoay|Rotate/i }).first();
        await expect(rotate).toBeVisible();
        await rotate.click();

        const r = await measureDialog(page, 'rotation-dialog', locale, theme, 'production-button', rotate);

        expect(r.role).toBe('dialog');
        expect(r.backgroundAriaHidden, 'background must be inert while the dialog is open').toBe(true);
        expect(r.accessibleName.length).toBeGreaterThan(0);
        expect(r.accessibleDescription.length).toBeGreaterThan(0);
        expect(r.initialFocusInsideDialog).toBe(true);
        expect(r.tabContained).toBe(true);
        expect(r.shiftTabContained).toBe(true);
        expect(r.escapeClosed).toBe(true);
        expect(r.focusReturnedToTrigger, `focus returned to ${r.focusReturnTarget}`).toBe(true);
      });

      test(`command palette via Cmd+K — ${locale}/${theme}`, async ({ page }) => {
        await seedTheme(page, theme);
        await page.goto(`/${locale}/zen-a11y-harness`, { waitUntil: 'domcontentloaded' });
        await page.locator('body').click({ position: { x: 5, y: 5 } });

        await page.keyboard.press('Meta+k');

        // Opened by keyboard shortcut, so there is no trigger element and no
        // exact-identity focus return to compare against; the observed target
        // is recorded instead of passing null off as a success.
        const r = await measureDialog(page, 'command-palette', locale, theme, 'keyboard-cmd-k');

        expect(r.role).toBe('dialog');
        expect(r.accessibleName.length, 'palette needs an accessible name').toBeGreaterThan(0);
        expect(
          r.accessibleDescription.length,
          'palette needs an accessible description',
        ).toBeGreaterThan(0);
        expect(r.backgroundAriaHidden, 'background must be inert while the palette is open').toBe(true);
        expect(r.initialFocusInsideDialog, `initial focus was ${r.initialFocus}`).toBe(true);
        expect(r.tabContained, 'Tab must stay inside the palette').toBe(true);
        expect(r.shiftTabContained, 'Shift+Tab must stay inside the palette').toBe(true);
        expect(r.escapeClosed, 'Escape must close the palette').toBe(true);
        expect(r.backgroundPointerEvents, 'body must block background interaction').toBe('none');
        // No trigger exists, so this must stay unmeasured rather than be
        // reported as a pass.
        expect(r.focusReturnedToTrigger).toBeNull();
      });
    }
  }

});
