import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
  target: 'es2020',
  // Zero runtime deps — pure fetch-based SDK
  external: [],
  esbuildOptions(options) {
    options.banner = {
      js: '// @sophia/raas-sdk — RaaS API client',
    };
  },
});
