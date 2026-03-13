'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { SmartNav } from '@/components/smart-nav';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace('/collection');
    }
  }, [user, isLoading, router]);

  if (isLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status">
        <span className="sr-only">Loading...</span>
        <div className="w-6 h-6 rounded-full border-2 border-rift-500 border-t-transparent animate-spin" aria-hidden />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,rgba(79,106,245,0.15),transparent_50%)]">
      <SmartNav />
      <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 py-12">
        <div className="text-center max-w-lg w-full">
          <h1 className="text-5xl sm:text-6xl font-bold text-white drop-shadow-[0_0_25px_rgba(79,106,245,0.4)] mb-3 tracking-tight">
            La Grieta
          </h1>
          <p className="text-rift-400 text-lg font-medium mb-1">The Rift</p>
          <p className="lg-text-secondary mb-8">The definitive companion app for Riftbound TCG</p>

          <div className="w-20 h-0.5 bg-gradient-to-r from-transparent via-rift-500 to-transparent mx-auto mb-8" aria-hidden />

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/cards" className="lg-btn-primary py-3 px-6 shadow-lg shadow-rift-600/20">Browse Cards</Link>
            <Link href="/register" className="lg-btn-secondary py-3 px-6">Create Account</Link>
          </div>

          <p className="mt-5 lg-text-muted">
            Already have an account?{' '}
            <Link href="/login" className="lg-btn-link">Sign in</Link>
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 w-full max-w-2xl animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {[
            { icon: IconCards, title: 'Browse Cards', desc: 'Explore 550+ cards across all Riftbound sets' },
            { icon: IconCollection, title: 'Track Collection', desc: 'Manage your cards with quantities and conditions' },
            { icon: IconDecks, title: 'Build Decks', desc: 'Create and share deck builds with the community' },
          ].map((f) => (
            <div key={f.title} className="group lg-card bg-surface-card/50 p-6 text-center space-y-3 hover:border-rift-800 transition-colors">
              <div className="w-11 h-11 mx-auto rounded-xl bg-rift-950/80 flex items-center justify-center text-rift-400 group-hover:bg-rift-900/60 transition-colors">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

/* Inline SVG icons for the feature cards */

function IconCards({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="12" height="16" rx="2" />
      <path d="M8 7h4M8 10h4M8 13h2" />
    </svg>
  );
}

function IconCollection({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="14" height="12" rx="2" />
      <path d="M5 5V4a2 2 0 012-2h6a2 2 0 012 2v1" />
      <path d="M7 10h6M7 13h3" />
    </svg>
  );
}

function IconDecks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="1" width="10" height="14" rx="1.5" />
      <rect x="3" y="3" width="10" height="14" rx="1.5" />
      <rect x="7" y="5" width="10" height="14" rx="1.5" />
    </svg>
  );
}
