import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      reporter: ['text', 'json-summary', 'html'],
      thresholds: {
        // Global thresholds set to 0 for initial baseline.
        // TODO: Increase these as test coverage improves.
        lines: 0,
        functions: 0,
        branches: 0,
        statements: 0,
      },
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/components/ui/**', // Exclude shadcn/ui components from strict coverage
        '**/*.d.ts',
        '**/*.config.ts',
      ],
    },
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
