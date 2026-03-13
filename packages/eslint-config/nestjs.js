// @ts-check
const base = require('./base');

/** @type {import('eslint').Linter.Config[]} */
const nestjs = [
  ...base,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        // NestJS requires project-aware type checking for decorators
        project: true,
      },
    },
    rules: {
      // NestJS uses parameter decorators heavily — these patterns are intentional
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Allow empty constructors (common in NestJS for DI)
      '@typescript-eslint/no-empty-function': ['error', { allow: ['constructors'] }],
    },
  },
  {
    // Test files: relax some rules
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/__tests__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
    },
  },
];

module.exports = nestjs;
