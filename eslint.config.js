// @ts-check
// Root ESLint flat config — applies to files at the repo root only.
// Each app/package has its own eslint.config.js extending @la-grieta/eslint-config.
const base = require('@la-grieta/eslint-config/base');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/riftbound-tcg-data/**',
      '**/*.js',
    ],
  },
  ...base,
];
