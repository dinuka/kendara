'use client';

import { signIn } from 'next-auth/react';

export default function LoginPage() {
  return (
    <main>
      <h1>Sign in to Kendara</h1>
      <button onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
        Sign in with Google
      </button>
    </main>
  );
}
