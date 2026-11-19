'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from './store';

/** Redirects anonymous visitors to onboarding and brings them back afterwards. */
export function useRequireAuth(): { ready: boolean } {
  const status = useSession((s) => s.status);
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (status === 'anon') router.replace(`/onboarding?next=${encodeURIComponent(path)}`);
  }, [status, router, path]);
  return { ready: status === 'authed' };
}

/**
 * Staff areas: anonymous visitors go to onboarding, and signed-in people without `role` are sent
 * home. `ready` is true only once the profile (and so the roles) is loaded.
 */
export function useRoleGuard(role: string): { ready: boolean; allowed: boolean } {
  const { ready } = useRequireAuth();
  const me = useSession((s) => s.me);
  const router = useRouter();
  const allowed = !!me?.roles.includes(role);
  const loaded = ready && !!me;
  useEffect(() => {
    if (loaded && !allowed) router.replace('/');
  }, [loaded, allowed, router]);
  return { ready: loaded, allowed };
}
