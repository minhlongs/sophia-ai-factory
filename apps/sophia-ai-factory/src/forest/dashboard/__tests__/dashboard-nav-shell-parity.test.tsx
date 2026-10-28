/**
 * Dashboard Navigation Shell Parity Tests
 *
 * The dashboard has more than one shell, and they must present the same task
 * configuration. When one shell gains a route the other does not have, the
 * customer's sidebar changes depending on which viewport they opened — the same
 * work appears in one place and is unreachable in another.
 *
 * @module forest/dashboard/__tests__/dashboard-nav-shell-parity
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const FOREST_MODULES_PATH = join(process.cwd(), 'src/forest/dashboard/dashboard-nav-modules.ts');
const STITCH_NAV_PATH = join(
  process.cwd(),
  'src/components/stitch/layouts/dashboard/default-nav-items.ts',
);

function hrefs(source: string): string[] {
  return [...source.matchAll(/href:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]);
}

function readSource(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('dashboard navigation shell parity', () => {
  const forestHrefs = hrefs(readSource(FOREST_MODULES_PATH));
  const stitchHrefs = hrefs(readSource(STITCH_NAV_PATH));

  it('offers the same routes in both dashboard shells', () => {
    expect(forestHrefs.length).toBeGreaterThan(0);
    expect(stitchHrefs.length).toBeGreaterThan(0);

    const onlyInForest = forestHrefs.filter((href) => !stitchHrefs.includes(href));
    const onlyInStitch = stitchHrefs.filter((href) => !forestHrefs.includes(href));

    expect(onlyInForest).toEqual([]);
    expect(onlyInStitch).toEqual([]);
  });

  it('lists the same number of items in both shells, so no shell hides work', () => {
    expect(stitchHrefs.length).toBe(forestHrefs.length);
  });

  it('resolves every dashboard nav href to a real route directory', () => {
    // A nav item with no route is a dead CTA for a non-technical customer.
    const missing = forestHrefs
      .filter((href) => href.startsWith('/dashboard'))
      .filter((href) => !routeDirExists(href));

    const missingStitch = stitchHrefs
      .filter((href) => href.startsWith('/dashboard'))
      .filter((href) => !routeDirExists(href));

    expect([...missing, ...missingStitch]).toEqual([]);
  });

  it('keeps the external affiliate business and the platform partner program apart', () => {
    // Two sibling routes that must never be replaced by one another.
    expect(forestHrefs).toContain('/dashboard/affiliates');
    expect(stitchHrefs).toContain('/dashboard/affiliates');
  });
});

function routeDirExists(href: string): boolean {
  const relative = href.startsWith('/dashboard')
    ? join('src/app/[locale]', href)
    : join('src/app', href);
  return existsSync(relative) && statSync(relative).isDirectory();
}
