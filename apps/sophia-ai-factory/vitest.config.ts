import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { config } from 'dotenv';

// Load .env.test for test environment
config({ path: '.env.test' });

export default defineConfig({
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
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
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
