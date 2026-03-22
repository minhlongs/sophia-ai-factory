import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    include: ['app/**/*.test.tsx', 'components/**/*.test.tsx', 'tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist', '.next'],
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    server: {
      deps: {
        inline: ['next/font/google'],
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  ssr: {
    noExternal: ['next/font/google'],
  },
});
