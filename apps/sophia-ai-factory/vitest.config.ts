import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

// Load .env.test for test environment
config({ path: '.env.test' });

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    testTimeout: 15000,
    setupFiles: ['./src/test/setup.tsx'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'src/**/*.contract.test.{ts,tsx}',
      '../../tests/**/*.test.{ts}',
      'scripts/__tests__/**/*.test.{ts,mts}',
    ],
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
        lines: 60,
        functions: 50,
        branches: 45,
        statements: 55,
        // Dashboard regression guard — keep minimal threshold since it's mostly UI.
        // Dashboard is primarily component-focused; coverage measured via component tests.
        'src/app/[locale]/dashboard/**': {
          lines: 5,
          branches: 5,
          functions: 5,
          statements: 5,
        },
        // Critical business domains require higher coverage
        'src/land/billing/**': {
          lines: 75,
          functions: 75,
          branches: 75,
          statements: 75,
        },
        'src/forest/usage-metering/**': {
          lines: 70,
          functions: 70,
          branches: 65,
          statements: 70,
        },
        'src/tree/usage-metering/**': {
          lines: 70,
          functions: 70,
          branches: 65,
          statements: 70,
        },
        'src/forest/telegram/**': {
          lines: 70,
          functions: 70,
          branches: 65,
          statements: 70,
        },
        'src/tree/telegram/**': {
          lines: 70,
          functions: 70,
          branches: 65,
          statements: 70,
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
