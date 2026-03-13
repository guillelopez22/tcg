'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function PublicNav() {
  const pathname = usePathname();
  const isCardsActive = pathname === '/cards' || pathname.startsWith('/cards/');

  return (
    <header className="lg-navbar">
      <nav className="lg-navbar-inner" aria-label="Site navigation">
        <Link href="/" className="lg-logo">La Grieta</Link>

        <div className="flex items-center gap-1">
          <Link
            href="/cards"
            className={isCardsActive ? 'lg-nav-link-active' : 'lg-nav-link'}
            aria-current={isCardsActive ? 'page' : undefined}
          >
            Cards
          </Link>
          <Link href="/login" className="lg-nav-link">Sign In</Link>
          <Link href="/register" className="lg-btn-primary ml-1 py-2 px-4">
            <span className="hidden sm:inline">Create Account</span>
            <span className="sm:hidden">Sign Up</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
