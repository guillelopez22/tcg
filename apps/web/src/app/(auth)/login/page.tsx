// Rendering: Client page — login form with tRPC mutation

import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign In',
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-white mb-1">Sign in</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Welcome back to La Grieta
      </p>
      <LoginForm />
    </div>
  );
}
