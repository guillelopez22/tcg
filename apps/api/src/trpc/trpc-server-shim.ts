/**
 * tRPC server shim for Vitest.
 *
 * tRPC v11 does not export createCallerFactory from the package root index.
 * This shim re-exports everything from the actual package dist files so all
 * existing imports of '@trpc/server' continue to work, while also exporting
 * createCallerFactory from the unstable-core subpath.
 *
 * Vitest resolves '@trpc/server' -> this shim (via alias in vitest.config.ts).
 * Subpath imports like '@trpc/server/unstable-core-do-not-import' bypass the
 * alias and resolve to the real package, preventing circular imports.
 */
export * from '@trpc/server/unstable-core-do-not-import';
