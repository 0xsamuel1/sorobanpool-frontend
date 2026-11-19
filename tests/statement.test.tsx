import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import StatementPage from '@/app/supplier/statement/page';

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
  session: { access: 'token' },
}));
vi.mock('@/lib/auth', () => ({
  useRequireAuth: () => ({ ready: true }),
}));

import { api } from '@/lib/api';

const messages = {
  statement: {
    title: 'Statement',
    note: 'All amounts in USD.',
    empty: 'No settled pools yet.',
    product: 'Product',
    gross: 'Gross',
    fees: 'Fees',
    net: 'Net',
    total: 'Total',
    settled: 'Settled',
    units: 'units',
    csv: 'Download CSV',
    pool: 'Pool',
  },
  common: { loading: 'Loading...' },
};

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <StatementPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('StatementPage (#125)', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows empty state when there are no lines', async () => {
    vi.mocked(api).mockResolvedValue({ lines: [], total: { gross: '0', platformFee: '0', organizerFee: '0', net: '0' } });
    wrap();
    await waitFor(() => expect(screen.getByTestId('statement-empty')).toBeTruthy());
  });

  it('renders one row per statement line', async () => {
    vi.mocked(api).mockResolvedValue({
      lines: [
        { poolId: 'p1', product: 'Rice', settledAt: '2026-11-01T00:00:00Z', unitsDelivered: 10, gross: '100000000', platformFee: '1500000', organizerFee: '500000', net: '98000000' },
        { poolId: 'p2', product: 'Beans', settledAt: '2026-11-02T00:00:00Z', unitsDelivered: 5, gross: '50000000', platformFee: '750000', organizerFee: '250000', net: '49000000' },
      ],
      total: { gross: '150000000', platformFee: '2250000', organizerFee: '750000', net: '147000000' },
    });
    wrap();
    await waitFor(() => expect(screen.getAllByTestId('statement-line')).toHaveLength(2));
  });

  it('renders totals row', async () => {
    vi.mocked(api).mockResolvedValue({
      lines: [
        { poolId: 'p1', product: 'Rice', settledAt: '2026-11-01T00:00:00Z', unitsDelivered: 10, gross: '100000000', platformFee: '1500000', organizerFee: '500000', net: '98000000' },
      ],
      total: { gross: '100000000', platformFee: '1500000', organizerFee: '500000', net: '98000000' },
    });
    wrap();
    await waitFor(() => expect(screen.getByTestId('statement-total')).toBeTruthy());
  });

  it('shows all four columns in the table', async () => {
    vi.mocked(api).mockResolvedValue({
      lines: [
        { poolId: 'p1', product: 'Rice', settledAt: '2026-11-01T00:00:00Z', unitsDelivered: 10, gross: '100000000', platformFee: '1500000', organizerFee: '500000', net: '98000000' },
      ],
      total: { gross: '100000000', platformFee: '1500000', organizerFee: '500000', net: '98000000' },
    });
    wrap();
    await waitFor(() => screen.getByText('Product'));
    expect(screen.getByText('Gross')).toBeTruthy();
    expect(screen.getByText('Fees')).toBeTruthy();
    expect(screen.getByText('Net')).toBeTruthy();
  });
});
