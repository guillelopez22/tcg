'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';

export function LoginForm() {
  const router = useRouter();
  const { user, isLoading, setAuth } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess(data) {
      setAuth(data.user, data.accessToken);
      router.push('/collection');
    },
    onError(err) {
      setError(err.message ?? 'Sign in failed. Please try again.');
    },
  });

  useEffect(() => {
    if (!isLoading && user) router.replace('/collection');
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div role="status" className="lg-spinner"><span className="sr-only">Loading</span></div>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password) { setError('Password is required.'); return; }

    login.mutate({ email: email.trim(), password });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 w-full max-w-sm">
      {error && <div role="alert" className="lg-alert-inline">{error}</div>}

      <div className="lg-field">
        <label htmlFor="email" className="lg-label">Email</label>
        <input id="email" type="email" autoComplete="email" required autoFocus
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="lg-input" placeholder="you@example.com" />
      </div>

      <div className="lg-field">
        <label htmlFor="password" className="lg-label">Password</label>
        <input id="password" type="password" autoComplete="current-password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
          className="lg-input" placeholder="••••••••" />
      </div>

      <button type="submit" disabled={login.isPending} className="lg-btn-primary w-full">
        {login.isPending ? 'Signing in...' : 'Sign in'}
      </button>

      <p className="text-center lg-text-muted">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="lg-btn-link">Create one</Link>
      </p>
    </form>
  );
}
