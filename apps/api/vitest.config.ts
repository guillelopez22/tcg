import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@la-grieta/db': resolve(__dirname, '../../packages/db/src/index.ts'),
      '@la-grieta/shared': resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
  // CJS packages that Vite cannot resolve as ESM must be listed here
  ssr: {
    noExternal: ['bcryptjs', 'jsonwebtoken'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts', '**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts'],
    },
  },
});
