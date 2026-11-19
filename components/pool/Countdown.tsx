'use client';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { countdown } from '@/lib/format';

const subscribe = (cb: () => void) => {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
};
// Floored to the second so the snapshot is stable between reads within a tick.
const snapshot = () => Math.floor(Date.now() / 1000) * 1000;

interface CountdownProps {
  deadline: string;
  /** Hours remaining below which to show amber warning. Default 6. */
  warnHours?: number;
  /** Hours remaining below which to show red critical state. Default 1. */
  criticalHours?: number;
  /** Show urgency explanation text (refund/reputation risk). Default false. */
  showExplainer?: boolean;
}

export function Countdown({ deadline, warnHours = 6, criticalHours = 1, showExplainer = false }: CountdownProps) {
  const t = useTranslations('pool');
  // null on the server: rendering a time there would mismatch the client's first paint.
  const now = useSyncExternalStore(subscribe, snapshot, () => null);
  if (now === null) return <span aria-hidden className="inline-block h-5 w-32 rounded bg-neutral-100" />;
  const c = countdown(deadline, now);
  if (c.done) return <span className="font-semibold text-neutral-700">{t('closed')}</span>;

  const msRemaining = new Date(deadline).getTime() - now;
  const hoursRemaining = msRemaining / 3_600_000;
  const isCritical = hoursRemaining < criticalHours;
  const isWarning = !isCritical && hoursRemaining < warnHours;

  const colorClass = isCritical
    ? 'font-bold text-red-600'
    : isWarning
      ? 'font-semibold text-amber-600'
      : 'font-semibold text-neutral-700';

  const parts = [c.days ? `${c.days}d` : '', `${c.hours}h`, `${c.minutes}m`, c.days ? '' : `${c.seconds}s`].filter(Boolean).join(' ');

  return (
    <span>
      <span className={`tabular-nums ${colorClass}`} aria-label={`${t('closes')} ${parts}`}>
        {t('closes')} {parts}
        {isCritical && <span className="ml-1 text-xs uppercase tracking-wide">{t('urgentCritical')}</span>}
        {isWarning && <span className="ml-1 text-xs">{t('urgentWarning')}</span>}
      </span>
      {showExplainer && (isWarning || isCritical) && (
        <span className="ml-2 text-xs text-neutral-600">
          {t('acceptWindowExplainer')}
        </span>
      )}
    </span>
  );
}
