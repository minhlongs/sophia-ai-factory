import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

// Load .env.test for test environment
config({ path: '.env.test' });

export default defineConfig({
  root: __dirname,
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
      '.next/**',
      '.open-next/**',
    ],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        lines: 25,
        functions: 20,
        branches: 20,
        statements: 25,
        // Dashboard regression guard — floor at observed baseline (2026-05-18 capture).
        // DO NOT lower without revising plans/260518-1728-sophia-zero-bug-dashboard/.
        // Contract tests in src/app/api/**/__tests__/*.contract.test.ts do NOT count toward
        // dashboard surface coverage — they cover API route schemas, not dashboard components.
        'src/app/[locale]/dashboard/**': {
          lines: 1.5,
          branches: 2.5,
          functions: 1,
          statements: 1.5,
        },
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/components/ui/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '.next/**',
        '.open-next/**',
      ],
    },
    server: {
      deps: {
        inline: [],
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
      'next/navigation': path.resolve(__dirname, './src/test/mocks/next-navigation.ts'),
      'next-intl/navigation': path.resolve(__dirname, './src/test/mocks/next-intl-navigation.tsx'),
    },
  },
  define: {
    'process.env.NODE_ENV': '"test"',
  },
  ssr: {
    noExternal: ['next/server', 'next-intl'],
  },
});
