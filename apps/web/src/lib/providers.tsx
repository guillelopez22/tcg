'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { trpc, createTRPCClient } from './trpc';
import { AuthProvider, useAuth } from './auth-context';

function TRPCProvider({ children }: { children: React.ReactNode }) {
  const { getAccessToken } = useAuth();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 seconds
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry on 401/403
              const trpcError = error as { data?: { httpStatus?: number } };
              const status = trpcError?.data?.httpStatus;
              if (status === 401 || status === 403) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  const [trpcClient] = useState(() => createTRPCClient(getAccessToken));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <TRPCProvider>
        {children}
        <Toaster
          theme="dark"
          position="top-right"
          toastOptions={{
            style: { background: '#16161e', border: '1px solid #2a2a3a', color: '#fff' },
          }}
        />
      </TRPCProvider>
    </AuthProvider>
  );
}
