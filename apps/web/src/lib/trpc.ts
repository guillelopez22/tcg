/**
 * tRPC client setup for the web app.
 *
 * Access token is stored in memory (React context), NOT localStorage.
 * Refresh token rotation is handled by the auth context via the auth.refresh procedure.
 *
 * AppRouter type is imported via a type-only path alias that points to the API source.
 * This import is erased at runtime — zero API bundle leakage into the web client.
 */
import { createTRPCReact } from '@trpc/react-query';
import { httpLink, loggerLink } from '@trpc/client';
import type { AppRouter } from '../types/router';

export const trpc = createTRPCReact<AppRouter>();

export function createTRPCClient(getAccessToken: () => string | null) {
  return trpc.createClient({
    links: [
      loggerLink({
        enabled: (opts) =>
          process.env.NODE_ENV === 'development' ||
          (opts.direction === 'down' && opts.result instanceof Error),
      }),
      httpLink({
        url: '/api/trpc',
        headers() {
          const token = getAccessToken();
          return token ? { authorization: `Bearer ${token}` } : {};
        },
        fetch(url, options) {
          return fetch(url, { ...options, credentials: 'include' });
        },
      }),
    ],
  });
}
