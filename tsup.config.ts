import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  bundle: true,
  splitting: false,
  minify: true,
  clean: true,
  sourcemap: false,
  dts: false,
  // Single-file output: inline all npm dependencies (zod et al.).
  // Node built-ins stay external automatically on platform: 'node'.
  noExternal: [/.*/],
  banner: { js: '#!/usr/bin/env node' },
  outDir: 'dist',
});
