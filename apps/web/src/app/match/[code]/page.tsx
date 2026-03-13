/**
 * Public match join/view page — outside (dashboard) auth guard.
 * Accessible by anyone with the join code or QR link, no login required.
 */

import { JoinForm } from './join-form';

interface MatchPageProps {
  params: { code: string };
}

export default function PublicMatchPage({ params }: MatchPageProps) {
  const { code } = params;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Minimal header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <span className="font-bold text-white text-sm tracking-wide">La Grieta</span>
        <span className="text-xs text-zinc-500 font-mono">{code}</span>
      </header>

      <main className="flex-1 flex flex-col lg-page-padding py-6 max-w-md mx-auto w-full">
        <JoinForm code={code} />
      </main>
    </div>
  );
}
