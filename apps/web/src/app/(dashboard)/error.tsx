'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <p className="text-zinc-400">Something went wrong.</p>
      <button
        onClick={reset}
        className="lg-btn-secondary"
      >
        Try again
      </button>
    </div>
  );
}
