import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface gap-4 px-4">
      <h1 className="text-4xl font-bold text-white">404</h1>
      <p className="text-zinc-400">This page does not exist.</p>
      <Link
        href="/"
        className="lg-btn-secondary"
      >
        Go home
      </Link>
    </div>
  );
}
