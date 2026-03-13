// @ts-check
const base = require('./base');

/** @type {import('eslint').Linter.Config[]} */
const next = [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Next.js App Router uses default exports for pages/layouts
      'import/prefer-default-export': 'off',
      // React hooks are validated by Next.js eslint config
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];

module.exports = next;
