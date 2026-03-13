// Rendering: Client page — register form with tRPC mutation

import type { Metadata } from 'next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create Account',
};

export default function RegisterPage() {
  return (
    <div className="w-full max-w-sm">
      <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
      <p className="text-sm text-zinc-400 mb-6">
        Join the La Grieta community
      </p>
      <RegisterForm />
    </div>
  );
}
