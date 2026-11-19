import { defineConfig } from 'vitest/config';

/**
 * Composite test run used by `pnpm test`.
 *
 * The unit suite (jsdom + shared setup) and the revenue journey suite (node, no
 * setup) need different environments and cannot share one config. Running them
 * as separate Vitest projects keeps both in a single invocation so CLI flags
 * such as --coverage or --reporter apply to both, while the journey tests never
 * load the shared jsdom setup that breaks them.
 */
export default defineConfig({
  test: {
    projects: ['./vitest.config.ts', './vitest.revenue-journey.config.ts'],
    coverage: {
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/*.config.ts', '.next/**', '.open-next/**'],
    },
  },
});
