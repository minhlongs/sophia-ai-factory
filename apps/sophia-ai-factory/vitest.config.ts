import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

// Ensure working directory is the application root
if (process.cwd() !== __dirname) {
  try {
    process.chdir(__dirname);
  } catch {}
}

// Load .env.test for test environment
config({ path: path.resolve(__dirname, '.env.test') });

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
      'tests/**/*.test.{ts,tsx}',
      '../../tests/**/*.test.{ts}',
      'scripts/__tests__/**/*.test.{ts,mts}',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      '**/*.config.ts',
      '.next/**',
      '.open-next/**',
      '**/.claude/**',
      '**/.agents/**',
    ],
    coverage: {
      reporter: ['text', 'json-summary', 'lcov', 'html'],
      // CI enforces a 70% threshold on changed executable lines. The whole-repo
      // baseline is reported but is not a merge gate because legacy domains are
      // below the previous static thresholds.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
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
