'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { LanguageToggle } from './language-toggle';

const navLinks = [
  { href: '/cards', label: 'Cards', icon: IconCards },
  { href: '/collection', label: 'Collection', icon: IconCollection },
  { href: '/decks', label: 'Decks', icon: IconDecks },
  { href: '/match', label: 'Match', icon: IconMatch },
  { href: '/scanner', label: 'Scanner', icon: IconScanner },
  { href: '/profile', label: 'Profile', icon: IconProfile },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuth();

  const logout = trpc.auth.logout.useMutation({
    onSuccess() {
      clearAuth();
      router.push('/login');
    },
    onError() {
      clearAuth();
      router.push('/login');
    },
  });

  return (
    <>
      {/* Desktop top nav */}
      <header className="lg-navbar">
        <nav className="lg-navbar-inner" aria-label="Main navigation">
          <Link href="/" className="lg-logo">La Grieta</Link>

          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive ? 'lg-nav-link-active' : 'lg-nav-link'}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle />
            <span className="hidden sm:block text-sm text-zinc-500">
              {user?.displayName ?? user?.username}
            </span>
            <button
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="text-sm text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              Sign out
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile bottom nav */}
      <div className="lg-mobile-nav">
        <nav className="flex items-center justify-around" aria-label="Mobile navigation">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={isActive ? 'lg-mobile-nav-link-active' : 'lg-mobile-nav-link'}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}

/* ── Icons (20x20 SVG, stroke-based) ── */

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

function IconProfile({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="7" r="3.5" />
      <path d="M3 18c0-3.5 3.1-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

function IconScanner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Viewfinder corners */}
      <path d="M3 7V4h3" />
      <path d="M17 7V4h-3" />
      <path d="M3 13v3h3" />
      <path d="M17 13v3h-3" />
      {/* Scan line */}
      <line x1="3" y1="10" x2="17" y2="10" strokeDasharray="2 1.5" />
    </svg>
  );
}

function IconMatch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Two crossed swords */}
      <line x1="4" y1="4" x2="16" y2="16" />
      <line x1="16" y1="4" x2="4" y2="16" />
      <circle cx="10" cy="10" r="2" />
    </svg>
  );
}
