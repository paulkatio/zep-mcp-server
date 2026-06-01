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
  // Externalize npm dependencies (the default). They are installed normally via
  // package.json "dependencies" when the package is run with npx. Inlining CJS
  // deps (pino/undici/ajv) into an ESM bundle breaks at runtime with
  // "Dynamic require of 'assert' is not supported".
  banner: { js: '#!/usr/bin/env node' },
  outDir: 'dist',
});
