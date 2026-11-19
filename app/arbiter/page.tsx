'use client';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ErrorExplainer } from '@/components/feedback/ErrorExplainer';
import { api } from '@/lib/api';
import type { DisputeView } from '@/lib/types';

/** The arbiter layout checks the role before this renders. */
export default function ArbiterQueue() {
  const t = useTranslations('arbiter');
  const q = useQuery({ queryKey: ['arbiter', 'queue'], queryFn: () => api<DisputeView[]>('/arbiter/queue'), refetchInterval: 15_000 });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      {q.error && <ErrorExplainer error={q.error} onRetry={() => void q.refetch()} />}
      {q.data?.length === 0 && <p className="text-neutral-700">{t('empty')}</p>}
      <ul className="space-y-3">
        {q.data?.map((d) => (
          <li key={d.id}>
            <Link href={`/arbiter/${d.id}`} className="block min-h-12 rounded-xl border border-neutral-200 bg-white p-4">
              <p className="font-semibold">#{d.id} · {d.claimedAmount} USD</p>
              <p className="text-sm text-neutral-700">{(d.msToSla ?? 0) > 0 ? t('sla', { hours: Math.ceil((d.msToSla ?? 0) / 3_600_000) }) : t('slaPassed')}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
