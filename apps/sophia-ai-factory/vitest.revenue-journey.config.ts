import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    name: 'revenue-journey',
    environment: 'node',
    setupFiles: [],
    server: { deps: { inline: ['next-intl'] } },
    include: ['tests/revenue-journey/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 20000,
    hookTimeout: 20000,
    env: { NODE_ENV: 'test' },
  },
});
