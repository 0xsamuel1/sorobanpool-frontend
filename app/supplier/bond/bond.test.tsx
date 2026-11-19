import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import BondPage from './page';

// Mock the modules that touch the network
vi.mock('@/lib/api', () => ({
  api: vi.fn(),
  session: { access: 'test-token' },
}));
vi.mock('@/lib/auth', () => ({
  useRequireAuth: () => ({ ready: true }),
}));
vi.mock('@/lib/tx', () => ({
  runAction: vi.fn((fn) => fn()),
}));
vi.mock('@/components/ConfirmDialog', () => ({
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));

import { api } from '@/lib/api';

const messages = {
  bond: {
    title: 'My Bond',
    back: 'Back',
    whyTitle: 'Why bond matters',
    whyBody: 'Your bond covers buyer refunds if you fail to deliver.',
    overview: 'Bond overview',
    total: 'Total',
    reserved: 'Reserved',
    free: 'Free',
    reservedNote: 'Reserved bond covers active pools.',
    depositTitle: 'Deposit',
    depositLabel: 'Amount (USD)',
    depositBtn: 'Deposit',
    withdrawTitle: 'Withdraw',
    withdrawNote: 'You can withdraw up to {free} USD.',
    withdrawLabel: 'Amount (USD)',
    withdrawBtn: 'Withdraw',
    withdrawLimitError: 'Amount exceeds free bond.',
  },
  common: { loading: 'Loading...' },
};

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <BondPage />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('BondPage', () => {
  beforeEach(() => {
    vi.mocked(api).mockResolvedValue({ total: '50000000', reserved: '10000000' }); // 5 USD total, 1 USD reserved
  });

  it('shows total, reserved, and free bond amounts', async () => {
    wrap();
    await waitFor(() => expect(screen.getByTestId('bond-total')).toBeTruthy());
    expect(screen.getByTestId('bond-reserved')).toBeTruthy();
    expect(screen.getByTestId('bond-free')).toBeTruthy();
  });

  it('free bond = total minus reserved', async () => {
    wrap();
    await waitFor(() => screen.getByTestId('bond-free'));
    // 5 USD - 1 USD = 4 USD free
    expect(screen.getByTestId('bond-free').textContent).toMatch(/4/);
  });

  it('deposit button disabled when amount is empty', async () => {
    wrap();
    await waitFor(() => screen.getByTestId('deposit-btn'));
    expect(screen.getByTestId('deposit-btn')).toBeDisabled();
  });

  it('shows withdraw limit error when amount exceeds free bond', async () => {
    wrap();
    await waitFor(() => screen.getByTestId('withdraw-btn'));
    const input = screen.getByLabelText('Amount (USD)', { selector: '#withdraw-amt' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100' } }); // 100 > 4 free
    await waitFor(() => expect(screen.getByTestId('withdraw-limit-error')).toBeTruthy());
    expect(screen.getByTestId('withdraw-btn')).toBeDisabled();
  });

  it('withdraw button enabled when amount is within free bond', async () => {
    wrap();
    await waitFor(() => screen.getByTestId('withdraw-btn'));
    const input = screen.getByLabelText('Amount (USD)', { selector: '#withdraw-amt' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } }); // 1 <= 4 free
    await waitFor(() => expect(screen.getByTestId('withdraw-btn')).not.toBeDisabled());
  });
});
