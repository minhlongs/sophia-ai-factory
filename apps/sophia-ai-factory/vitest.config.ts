import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

// Load .env.test for test environment
config({ path: '.env.test' });

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react() as any],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.config.ts',
    ],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        // Global thresholds remain at 0 — coverage gate is dashboard-scoped only.
        // See plans/260518-1728-sophia-zero-bug-dashboard/reports/phase-01-baseline.json
        // for observed baseline. Ratcheting to 65/50/60/65 happens in Phase 03 Track B.
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
        // Dashboard regression guard — floor at observed baseline (2026-05-18 capture).
        // DO NOT lower without revising plans/260518-1728-sophia-zero-bug-dashboard/.
        // Ratcheting to 65/50/60/65 (lines/branches/functions/statements) is deferred to
        // a future phase once new dashboard unit tests land (Track B Phase 03 intent).
        // Contract tests in src/app/api/**/__tests__/*.contract.test.ts do NOT count toward
        // dashboard surface coverage — they cover API route schemas, not dashboard components.
        'src/app/[locale]/dashboard/**': {
          lines: 4,
          branches: 4,
          functions: 2,
          statements: 3,
        },
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/components/ui/**',
        '**/*.d.ts',
        '**/*.config.ts',
      ],
    },
    // Mock server-side modules for API route tests
    server: {
      deps: {
        inline: [
          // Inline these to allow mocking
        ],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/seed': path.resolve(__dirname, './src/seed'),
      '@/tree': path.resolve(__dirname, './src/tree'),
      '@/forest': path.resolve(__dirname, './src/forest'),
      '@/land': path.resolve(__dirname, './src/land'),
    },
  },
  // Define globals for tests
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  // SSR config for API route mocking
  ssr: {
    noExternal: ['next/server'],
  },
});
