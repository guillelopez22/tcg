/**
 * AppRouter type for the tRPC client.
 *
 * We import type-only from the API source. TypeScript can resolve this because:
 * 1. The @api/* path alias in tsconfig.json points to ../api/src/*
 * 2. @la-grieta/db and @la-grieta/shared path aliases are also defined
 * 3. This is a type-only import — no API code runs in the browser
 */
export type { AppRouter } from '@api/trpc/trpc.router';
