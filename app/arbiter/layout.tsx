'use client';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { SessionGuard } from '@/components/SessionGuard';
import { useRoleGuard } from '@/lib/auth';

/** Arbiter area: only arbiters see it, and an idle arbiter session ends like an admin one. */
export default function ArbiterLayout({ children }: { children: ReactNode }) {
  const t = useTranslations('arbiter');
  const common = useTranslations('common');
  const { ready, allowed } = useRoleGuard('ARBITER');
  if (!ready) return <p>{common('loading')}</p>;
  if (!allowed) return <p role="status" className="rounded-xl bg-amber-50 p-4">{t('notArbiter')}</p>;
  return (
    <>
      {children}
      <SessionGuard />
    </>
  );
}
