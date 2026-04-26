'use client';

import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

const SignOutButton = () => (
  <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/' })}>
    Sign out
  </Button>
);

export default SignOutButton;
