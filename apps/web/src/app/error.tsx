'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-surface gap-4 px-4">
          <h1 className="text-xl font-bold text-white">Something went wrong</h1>
          <p className="text-zinc-400 text-sm">An unexpected error occurred.</p>
          <div className="flex gap-3">
            <button
              onClick={reset}
              className="lg-btn-primary"
            >
              Try again
            </button>
            <Link
              href="/"
              className="lg-btn-secondary"
            >
              Go home
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
