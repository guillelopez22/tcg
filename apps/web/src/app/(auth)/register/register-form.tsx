'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';

export function RegisterForm() {
  const router = useRouter();
  const { user, isLoading, setAuth } = useAuth();

  useEffect(() => {
    if (!isLoading && user) router.replace('/collection');
  }, [user, isLoading, router]);

  const [form, setForm] = useState({ email: '', username: '', password: '', displayName: '', city: '' });
  const [error, setError] = useState<string | null>(null);

  const register = trpc.auth.register.useMutation({
    onSuccess(data) {
      setAuth(data.user, data.accessToken);
      router.push('/collection');
    },
    onError(err) {
      setError(err.message ?? 'Registration failed. Please try again.');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div role="status" className="lg-spinner"><span className="sr-only">Loading</span></div>
      </div>
    );
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.email.trim()) { setError('Email is required.'); return; }
    if (!/\S+@\S+\.\S+/.test(form.email)) { setError('Please enter a valid email address.'); return; }
    if (!form.username.trim()) { setError('Username is required.'); return; }
    if (form.username.length < 3) { setError('Username must be at least 3 characters.'); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(form.username)) { setError('Username can only contain letters, numbers, underscores, and hyphens.'); return; }
    if (!form.password) { setError('Password is required.'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(form.password)) { setError('Password must contain at least one letter and one number.'); return; }

    register.mutate({
      email: form.email.trim(),
      username: form.username.trim(),
      password: form.password,
      displayName: form.displayName || undefined,
      city: form.city || undefined,
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 w-full max-w-sm">
      {error && <div role="alert" className="lg-alert-inline">{error}</div>}

      <div className="lg-field">
        <label htmlFor="email" className="lg-label">Email <span className="text-red-400">*</span></label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus
          value={form.email} onChange={handleChange} className="lg-input" placeholder="you@example.com" />
      </div>

      <div className="lg-field">
        <label htmlFor="username" className="lg-label">Username <span className="text-red-400">*</span></label>
        <input id="username" name="username" type="text" autoComplete="username" required
          minLength={3} maxLength={50} pattern="[a-zA-Z0-9_-]+"
          value={form.username} onChange={handleChange} className="lg-input" placeholder="summoner_name" />
        <p className="lg-hint">Letters, numbers, underscores, and hyphens only</p>
      </div>

      <div className="lg-field">
        <label htmlFor="password" className="lg-label">Password <span className="text-red-400">*</span></label>
        <input id="password" name="password" type="password" autoComplete="new-password" required
          minLength={8} value={form.password} onChange={handleChange} className="lg-input" placeholder="Minimum 8 characters" />
      </div>

      <div className="lg-field">
        <label htmlFor="displayName" className="lg-label">Display name</label>
        <input id="displayName" name="displayName" type="text" autoComplete="name"
          value={form.displayName} onChange={handleChange} className="lg-input" placeholder="Optional" />
      </div>

      <div className="lg-field">
        <label htmlFor="city" className="lg-label">City</label>
        <input id="city" name="city" type="text"
          value={form.city} onChange={handleChange} className="lg-input" placeholder="Tegucigalpa, San Pedro Sula..." />
      </div>

      <button type="submit" disabled={register.isPending} className="lg-btn-primary w-full">
        {register.isPending ? 'Creating account...' : 'Create account'}
      </button>

      <p className="text-center lg-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="lg-btn-link">Sign in</Link>
      </p>
    </form>
  );
}
