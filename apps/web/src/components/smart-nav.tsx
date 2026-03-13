'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { DashboardNav } from '@/components/dashboard-nav';
import { PublicNav } from '@/components/public-nav';

function NavSkeleton() {
  return (
    <header className="lg-navbar">
      <div className="lg-navbar-inner">
        <Link href="/" className="lg-logo">La Grieta</Link>
      </div>
    </header>
  );
}

export function SmartNav() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <NavSkeleton />;
  if (user) return <DashboardNav />;
  return <PublicNav />;
}
