'use client';

import { useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';

export function ProfileEditor() {
  const { user: authUser, updateUser } = useAuth();
  const utils = trpc.useUtils();

  const { data: profile, isLoading } = trpc.auth.me.useQuery(undefined, { enabled: !!authUser });

  const [form, setForm] = useState({ displayName: '', bio: '', city: '', whatsappPhone: '' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? '',
        bio: profile.bio ?? '',
        city: profile.city ?? '',
        whatsappPhone: profile.whatsappPhone ?? '',
      });
    }
  }, [profile]);

  const update = trpc.user.updateProfile.useMutation({
    onSuccess(data) {
      updateUser({ displayName: data.displayName });
      void utils.auth.me.invalidate();
      toast.success('Profile saved');
    },
    onError(err) { setError(err.message ?? 'Update failed. Please try again.'); },
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    update.mutate({
      displayName: form.displayName || undefined,
      bio: form.bio || undefined,
      city: form.city || undefined,
      whatsappPhone: form.whatsappPhone || undefined,
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-md" role="status">
        <span className="sr-only">Loading profile</span>
        <div className="h-6 w-32 bg-surface-elevated rounded animate-pulse" />
        <div className="lg-card px-4 py-3 space-y-2">
          <div className="h-3 w-16 bg-surface-elevated rounded animate-pulse" />
          <div className="h-4 w-28 bg-surface-elevated rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 bg-surface-elevated rounded animate-pulse" />
              <div className="h-10 bg-surface-elevated rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md">
      <h1 className="lg-page-title">Profile</h1>

      <div className="lg-card px-4 py-3 space-y-1">
        <p className="lg-text-muted">Username</p>
        <p className="text-sm font-medium text-white">{authUser?.username}</p>
        <p className="lg-text-muted mt-2">Email</p>
        <p className="text-sm text-zinc-300">{authUser?.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="lg-alert-inline">{error}</div>}

        <div className="lg-field">
          <label htmlFor="displayName" className="lg-label">Display name</label>
          <input id="displayName" name="displayName" type="text" maxLength={100}
            value={form.displayName} onChange={handleChange} className="lg-input" placeholder="Your name" />
        </div>

        <div className="lg-field">
          <label htmlFor="bio" className="lg-label">Bio</label>
          <textarea id="bio" name="bio" maxLength={500} value={form.bio} onChange={handleChange} rows={3}
            className="lg-input resize-none" placeholder="Tell the community about yourself" />
        </div>

        <div className="lg-field">
          <label htmlFor="city" className="lg-label">City</label>
          <input id="city" name="city" type="text" maxLength={100}
            value={form.city} onChange={handleChange} className="lg-input" placeholder="Tegucigalpa, San Pedro Sula..." />
        </div>

        <div className="lg-field">
          <label htmlFor="whatsappPhone" className="lg-label">WhatsApp number</label>
          <input id="whatsappPhone" name="whatsappPhone" type="tel" maxLength={20}
            value={form.whatsappPhone} onChange={handleChange} className="lg-input" placeholder="+504 9999-9999" />
          <p className="lg-hint">Used to link the marketplace WhatsApp bot</p>
        </div>

        <button type="submit" disabled={update.isPending} className="lg-btn-primary w-full">
          {update.isPending ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
