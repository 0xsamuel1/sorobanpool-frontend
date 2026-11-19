import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { PoolRow } from '@/app/supplier/page';
import type { PoolCard } from '@/lib/types';

vi.mock('@/lib/api', () => ({
  api: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({
  useRequireAuth: () => ({ ready: true }),
}));
vi.mock('@/lib/tx', () => ({
  runAction: vi.fn(async (fn) => fn()),
}));
vi.mock('@/lib/upload', () => ({
  uploadEvidence: vi.fn().mockResolvedValue({ evidenceId: 'ev-1', sha256: 'abc123def456' }),
}));
vi.mock('@/components/ConfirmDialog', () => ({
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));

import { api } from '@/lib/api';
import { uploadEvidence } from '@/lib/upload';
import { runAction } from '@/lib/tx';

const baseCard: PoolCard = {
  id: 'pool-1',
  state: 'Accepted',
  organizer: '0xORG',
  supplier: '0xSUP',
  shareSlug: 'slug',
  title: 'Test Pool',
  unitLabel: 'kg',
  currentUnitPriceNaira: null,
  moq: 10,
  totalUnits: 50,
  progressPct: 100,
  fillDeadline: new Date(Date.now() + 3_600_000).toISOString(),
  hub: 'Lagos',
};

const messages = {
  supplier: {
    dispatch: 'Dispatch',
    waybillTitle: 'Waybill photo',
    waybillNote: 'Capture a photo of the waybill to attach it to this delivery.',
    waybillCapture: 'Take photo',
    waybillRetake: 'Retake',
    waybillPreviewAlt: 'Waybill preview',
    dispatchWithWaybill: 'Dispatch with waybill',
    dispatchSkipWaybill: 'Skip & dispatch',
    cancel: 'Cancel',
    accept: 'Accept',
    reject: 'Reject',
    acceptBy: 'Accept by',
    payout: 'Payout: {amount}',
    pools: 'Your pools',
    noPools: 'No pools',
  },
  pool: { closes: 'Closes in', closed: 'Closed', urgentWarning: '— act soon', urgentCritical: '— URGENT', acceptWindowExplainer: '' },
};

function wrap(card: PoolCard = baseCard) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(api).mockResolvedValue({ id: 'pool-1', state: 'Accepted', totalUnits: 50 });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <ul><PoolRow card={card} /></ul>
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe('PoolRow waybill capture (#127)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows dispatch button for Accepted pools', async () => {
    wrap();
    await waitFor(() => expect(screen.getByText('Dispatch')).toBeTruthy());
  });

  it('opens waybill capture UI when Dispatch clicked', async () => {
    wrap();
    await waitFor(() => screen.getByText('Dispatch'));
    fireEvent.click(screen.getByText('Dispatch'));
    expect(screen.getByTestId('waybill-capture')).toBeTruthy();
  });

  it('dispatches without waybill when skip chosen', async () => {
    wrap();
    await waitFor(() => screen.getByText('Dispatch'));
    fireEvent.click(screen.getByText('Dispatch'));
    fireEvent.click(screen.getByTestId('dispatch-skip-waybill'));
    await waitFor(() => expect(runAction).toHaveBeenCalled());
    expect(uploadEvidence).not.toHaveBeenCalled();
  });

  it('uploads waybill and passes hash when dispatch with waybill chosen', async () => {
    wrap();
    await waitFor(() => screen.getByText('Dispatch'));
    fireEvent.click(screen.getByText('Dispatch'));
    // Simulate file selection
    const file = new File(['data'], 'waybill.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('waybill-input') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('dispatch-with-waybill')).not.toBeDisabled());
    fireEvent.click(screen.getByTestId('dispatch-with-waybill'));
    await waitFor(() => expect(uploadEvidence).toHaveBeenCalledWith('WAYBILL', 'pool-1', file));
    expect(runAction).toHaveBeenCalled();
  });
});
