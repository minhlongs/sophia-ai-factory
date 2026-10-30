/**
 * Onboarding Link Target Tests
 *
 * Guards the canonical Setup Wizard route. Onboarding links that point at a
 * dashboard path with no page leave a non-technical customer on a dead end, so
 * every link must resolve to a route that actually exists.
 * @module forest/dashboard/__tests__/onboarding-link-targets
 */

import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const APP_ROOT = process.cwd();
const APP_DIR = join(APP_ROOT, 'src/app');

function localeRouteExists(localeRelative: string): boolean {
  // Accepts both /setup (canonical) and /setup-wizard (alias) style segments.
  const path = join(APP_DIR, '[locale]', localeRelative);
  return existsSync(path) && statSync(path).isDirectory();
}

function routeHasPage(routePath: string): boolean {
  const withLocale = routePath.startsWith('/[locale]')
    ? routePath
    : join('[locale]', routePath);
  const dir = join(APP_DIR, withLocale);
  return existsSync(join(dir, 'page.tsx')) || existsSync(join(dir, 'page.ts'));
}

describe('canonical Setup Wizard routes', () => {
  it('serves the wizard at /[locale]/setup', () => {
    expect(localeRouteExists('setup')).toBe(true);
    expect(routeHasPage('/setup')).toBe(true);
  });

  it('serves the wizard at /[locale]/setup-wizard as a compatible alias', () => {
    expect(localeRouteExists('setup-wizard')).toBe(true);
    expect(routeHasPage('/setup-wizard')).toBe(true);
  });

  it('has no page behind /[locale]/dashboard/setup, so links must not target it', () => {
    expect(localeRouteExists('dashboard/setup')).toBe(true);
    expect(routeHasPage('/dashboard/setup')).toBe(false);
  });
});
