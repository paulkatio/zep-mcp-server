import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'src/schemas/generated/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  },
  {
    // Node dev/ops scripts (ESM .mjs): Node globals are implicit, not declared.
    files: ['scripts/**/*.{js,mjs,cjs}'],
    rules: { 'no-undef': 'off' },
  },
);
