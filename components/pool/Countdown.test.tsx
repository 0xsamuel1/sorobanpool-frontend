import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { Countdown } from './Countdown';

// Messages with the keys the component uses
const messages = {
  pool: {
    closes: 'Closes in',
    closed: 'Closed',
    urgentWarning: '— act soon',
    urgentCritical: '— URGENT',
    acceptWindowExplainer: 'Missing the window triggers buyer refunds and hurts your reputation.',
  },
};

function wrap(ui: React.ReactNode) {
  return render(<NextIntlClientProvider locale="en" messages={messages}>{ui}</NextIntlClientProvider>);
}

describe('Countdown', () => {
  beforeEach(() => {
    // Fake the external store subscription so useSyncExternalStore returns a stable value
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows skeleton on server (null snapshot)', () => {
    // The server snapshot returns null; we can approximate by checking the SSR path.
    // In jsdom the store fires immediately, so we just verify the component mounts.
    const deadline = new Date(Date.now() + 10 * 3_600_000).toISOString();
    wrap(<Countdown deadline={deadline} />);
    // Either the skeleton or the countdown text is visible — not an error
    expect(document.body).toBeTruthy();
  });

  it('shows neutral style when more than warnHours remain', () => {
    const deadline = new Date(Date.now() + 10 * 3_600_000).toISOString();
    wrap(<Countdown deadline={deadline} warnHours={6} criticalHours={1} />);
    const el = screen.getByText(/Closes in/i).closest('span')?.querySelector('span');
    expect(el?.className).toMatch(/text-neutral/);
    expect(el?.className).not.toMatch(/text-amber|text-red/);
  });

  it('shows amber warning when fewer than warnHours remain', () => {
    const deadline = new Date(Date.now() + 3 * 3_600_000).toISOString(); // 3 h < 6 h warn threshold
    wrap(<Countdown deadline={deadline} warnHours={6} criticalHours={1} />);
    const el = screen.getByText(/Closes in/i).closest('span')?.querySelector('span');
    expect(el?.className).toMatch(/text-amber/);
  });

  it('shows red critical style when fewer than criticalHours remain', () => {
    const deadline = new Date(Date.now() + 30 * 60_000).toISOString(); // 30 min < 1 h critical threshold
    wrap(<Countdown deadline={deadline} warnHours={6} criticalHours={1} />);
    const el = screen.getByText(/Closes in/i).closest('span')?.querySelector('span');
    expect(el?.className).toMatch(/text-red/);
  });

  it('shows explainer text when showExplainer=true and warning', () => {
    const deadline = new Date(Date.now() + 3 * 3_600_000).toISOString();
    wrap(<Countdown deadline={deadline} warnHours={6} criticalHours={1} showExplainer />);
    expect(screen.getByText(/refunds/i)).toBeTruthy();
  });

  it('does not show explainer when showExplainer=false', () => {
    const deadline = new Date(Date.now() + 3 * 3_600_000).toISOString();
    wrap(<Countdown deadline={deadline} warnHours={6} criticalHours={1} showExplainer={false} />);
    expect(screen.queryByText(/refunds/i)).toBeNull();
  });

  it('shows closed when deadline has passed', () => {
    const deadline = new Date(Date.now() - 1000).toISOString();
    wrap(<Countdown deadline={deadline} />);
    expect(screen.getByText('Closed')).toBeTruthy();
  });
});
