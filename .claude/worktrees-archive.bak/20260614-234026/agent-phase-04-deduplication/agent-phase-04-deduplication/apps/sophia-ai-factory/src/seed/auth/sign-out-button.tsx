'use client';

/**
 * SignOutButton — invalidates Better Auth session before navigating home.
 * Replaces the plain <Link href="/"> that left session cookies intact.
 * @module seed/auth/sign-out-button
 */

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { authClient } from '@/seed/auth/better-auth-client';

interface SignOutButtonProps {
  label: string;
  className?: string;
}

export function SignOutButton({ label, className }: SignOutButtonProps) {
  const router = useRouter();

  async function handleSignOut() {
    try {
      await authClient.signOut();
    } catch {
      // Fallback: direct cookie-clearing endpoint
      await fetch('/api/auth/sign-out', { method: 'POST', credentials: 'include' });
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className={
        className ??
        'flex items-center gap-3 px-4 py-3 text-destructive rounded-lg hover:bg-destructive/10 transition-colors w-full'
      }
    >
      <LogOut className="w-5 h-5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}
