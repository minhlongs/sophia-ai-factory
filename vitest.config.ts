import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
  esbuild: {
    jsxInject: "import React from 'react'",
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app/**/*.{ts,tsx}'],
      exclude: ['app/**/*.test.{ts,tsx}'],
      thresholds: {
        global: {
          lines: 50,
        },
      },
    },
    include: ['app/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
  },
});
