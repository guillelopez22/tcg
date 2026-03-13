import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'La Grieta', template: '%s | La Grieta' },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface bg-[radial-gradient(ellipse_at_top,rgba(79,106,245,0.08),transparent_50%)]">
      <header className="flex items-center justify-center py-6">
        <Link href="/" className="lg-logo text-xl">La Grieta</Link>
      </header>
      <main id="main-content" className="flex flex-1 items-center justify-center px-4 pb-16">
        {children}
      </main>
    </div>
  );
}
