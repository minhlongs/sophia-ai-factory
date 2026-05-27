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
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
      include: [
        'src/tree/byok/**/*.{ts,tsx}',
        'src/tree/clients/**/*.{ts,tsx}',
        'src/tree/handover/**/*.{ts,tsx}',
        'src/seed/utils/**/*.{ts,tsx}',
      ],
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
