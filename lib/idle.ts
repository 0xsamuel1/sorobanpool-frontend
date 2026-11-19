'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Seconds shown in the warning before an idle session ends. */
export const WARNING_SECONDS = 60;

const ACTIVITY = ['pointerdown', 'keydown', 'touchstart', 'scroll'] as const;

/**
 * Tracks inactivity. Activity pushes the deadline back, except during the warning: the warning
 * needs an explicit answer, so a stray tap cannot quietly keep a staff session alive.
 * `secondsLeft` is null until the warning starts; `extend()` answers it.
 */
export function useIdleTimeout({ minutes, onTimeout }: { minutes: number; onTimeout: () => void }): {
  secondsLeft: number | null;
  extend: () => void;
} {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const deadline = useRef(0);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  const restart = useCallback(() => {
    deadline.current = Date.now() + minutes * 60_000;
    setSecondsLeft(null);
  }, [minutes]);

  useEffect(() => {
    restart();
    const id = setInterval(() => {
      const left = deadline.current - Date.now();
      if (left <= 0) {
        clearInterval(id);
        deadline.current = Number.POSITIVE_INFINITY; // fire once
        onTimeoutRef.current();
        return;
      }
      setSecondsLeft(left <= WARNING_SECONDS * 1000 ? Math.ceil(left / 1000) : null);
    }, 1000);
    const onActivity = () => {
      if (deadline.current - Date.now() > WARNING_SECONDS * 1000) restart();
    };
    for (const event of ACTIVITY) window.addEventListener(event, onActivity, { passive: true });
    return () => {
      clearInterval(id);
      for (const event of ACTIVITY) window.removeEventListener(event, onActivity);
    };
  }, [restart]);

  return { secondsLeft, extend: restart };
}
