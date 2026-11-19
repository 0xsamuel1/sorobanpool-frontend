import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import type { CategoryRow, RiskOverview } from '@/lib/types';

let handler: (path: string, opts?: { body?: unknown }) => Promise<unknown>;
const signOut = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', async (orig) => ({
  ...(await orig<typeof import('@/lib/api')>()),
  api: vi.fn((p: string, o?: { body?: unknown }) => handler(p, o)),
}));
vi.mock('@/lib/store', () => ({ useSession: { getState: () => ({ signOut }) } }));
vi.mock('next/link', () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => '/admin' }));

import AdminParams from '@/app/admin/params/page';
import AdminCategories from '@/app/admin/categories/page';
import Risk from '@/app/admin/page';
import { SessionGuard } from '@/components/SessionGuard';

const wrap = (ui: React.ReactElement) =>
  renderIntl(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

describe('admin parameter proposals', () => {
  const params = [{ key: 'fee', label: 'Platform fee', value: 200, min: 0, max: 500, unit: 'bps' }];

  it('blocks a value above its hard cap', async () => {
    handler = async () => ({ params });
    wrap(<AdminParams />);
    fireEvent.change(await screen.findByLabelText('Platform fee'), { target: { value: '900' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Above the maximum of 500 bps.');
    expect(screen.getByRole('button', { name: 'Prepare change' })).toBeDisabled();
  });

  it('shows the diff and exports the XDR for signers', async () => {
    handler = async (p) => (p === '/admin/params' ? { params } : { txXdr: 'AAAAxdr' });
    wrap(<AdminParams />);
    fireEvent.change(await screen.findByLabelText('Platform fee'), { target: { value: '300' } });
    expect(screen.getByText('200 → 300 bps')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare change' }));
    expect(await screen.findByLabelText('Transaction XDR')).toHaveValue('AAAAxdr');
    expect(screen.getByRole('button', { name: 'Download .xdr' })).toBeInTheDocument();
  });
});

describe('admin category allow-list', () => {
  const rows: CategoryRow[] = [
    { id: 'c1', name: 'Rice', perishable: false, enabled: true, onChain: false },
    { id: 'c2', name: 'Tomatoes', perishable: true, enabled: false, onChain: null },
  ];

  it('shows status, the perishable flag and a mismatch with the chain', async () => {
    handler = async () => rows;
    wrap(<AdminCategories />);
    expect(await screen.findByText('Tomatoes')).toBeInTheDocument();
    expect(screen.getByText(/Perishable/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Differs from the on-chain list.');
  });

  it('asks for confirmation, then prepares the change and shows its XDR', async () => {
    const calls: { path: string; body?: unknown }[] = [];
    handler = async (p, o) => {
      calls.push({ path: p, body: o?.body });
      return { txXdr: 'BBBBxdr' };
    };
    wrap(<AdminCategories />);
    fireEvent.click(await screen.findByRole('button', { name: 'Enable' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Change Tomatoes?');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByLabelText('Transaction XDR')).toHaveValue('BBBBxdr');
    expect(calls).toContainEqual({ path: '/admin/categories/c2/toggle/prepare', body: { enabled: true } });
  });
});

describe('admin risk time window', () => {
  const overview: RiskOverview = {
    gmv: '1000000000', escrowHeld: '250000000', poolsByState: {}, failureRate7d: 0.12, dispute7d: { disputes: 1, deliveredPools: 20, rate: 0.05 },
    bySupplier: [], pairs: [], flags: [], generatedAt: '2026-10-10T12:00:00Z',
  };

  it('reloads the overview for the chosen window', async () => {
    const paths: string[] = [];
    handler = async (p) => {
      paths.push(p);
      return overview;
    };
    wrap(<Risk />);
    await screen.findByText('100 USD');
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 days' }));
    await waitFor(() => expect(paths).toContain('/admin/risk/overview?window=30'));
    expect(screen.getByRole('button', { name: 'Last 30 days' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('staff session idle timeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    signOut.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('warns in the last minute, and "Stay signed in" resets the clock', () => {
    renderIntl(<SessionGuard />);
    act(() => vi.advanceTimersByTime(14 * 60_000 + 1000));
    expect(screen.getByRole('dialog')).toHaveTextContent('60 seconds');
    fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => vi.advanceTimersByTime(10 * 60_000));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('signs out when the warning runs out', () => {
    renderIntl(<SessionGuard />);
    act(() => vi.advanceTimersByTime(15 * 60_000 + 1000));
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
