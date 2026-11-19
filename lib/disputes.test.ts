import { describe, expect, it } from 'vitest';
import { hoursLeft, nairaToUsdcStroops, outcomePreview, slaBreached, sortAndFilterQueue } from './disputes';
import type { DisputeView } from './types';

const A = 80_000_000n; // 8 USDC claimed
const P = 8_000_000n; // 0.8 USDC per unit

describe('outcomePreview', () => {
  it('pays the supplier everything on release and the buyer everything on refund-pool', () => {
    expect(outcomePreview(A, P, { kind: 'ReleaseToSupplier' })).toEqual({ buyer: 0n, supplier: A });
    expect(outcomePreview(A, P, { kind: 'RefundPool' })).toEqual({ buyer: A, supplier: 0n });
  });
  it('refunds units at the final price, capped at the claim', () => {
    expect(outcomePreview(A, P, { kind: 'RefundMember', units: 6 })).toEqual({ buyer: 48_000_000n, supplier: 32_000_000n });
    expect(outcomePreview(A, P, { kind: 'RefundMember', units: 99 })).toEqual({ buyer: A, supplier: 0n });
    expect(outcomePreview(A, P, { kind: 'RefundMember', units: -3 })).toEqual({ buyer: 0n, supplier: A });
  });
  it('splits by basis points with the remainder to the supplier, never losing a stroop', () => {
    const r = outcomePreview(10n, P, { kind: 'Split', bp: 3333 });
    expect(r.buyer + r.supplier).toBe(10n);
    expect(r.buyer).toBe(3n);
    expect(outcomePreview(A, P, { kind: 'Split', bp: 99_999 }).buyer).toBe(A); // clamped to 100%
  });
});

describe('helpers', () => {
  it('counts hours to the SLA and stops at zero', () => {
    const now = Date.UTC(2026, 9, 5, 10);
    expect(hoursLeft(new Date(now + 90 * 60_000), now)).toBe(2);
    expect(hoursLeft(new Date(now - 1000), now)).toBe(0);
  });
  it('previews USDC for naira prices, rounding down like the server', () => {
    expect(nairaToUsdcStroops(1500n, 1500)).toBe(10_000_000n);
    expect(nairaToUsdcStroops(1n, 3)).toBe(3_333_333n);
  });
});

const row = (id: string, claimedAmount: string, msToSla: number, reasonCode?: string): DisputeView =>
  ({ id, poolId: 'p', opener: 'o', state: 'OPEN', claimedAmount, openedAt: '', slaDueAt: '', msToSla, reasonCode }) as DisputeView;

describe('arbiter queue', () => {
  const queue = [row('1', '5', 7_200_000, 'Damaged'), row('2', '20', -3_600_000, 'Short'), row('3', '12', 1_000, 'Damaged')];

  it('flags breached SLAs', () => {
    expect(slaBreached({ msToSla: -1 })).toBe(true);
    expect(slaBreached({ msToSla: 0 })).toBe(true);
    expect(slaBreached({ msToSla: 1 })).toBe(false);
  });
  it('sorts by SLA with the most overdue and soonest first', () => {
    expect(sortAndFilterQueue(queue, { sort: 'sla' }).map((d) => d.id)).toEqual(['2', '3', '1']);
  });
  it('sorts by value, largest claim first', () => {
    expect(sortAndFilterQueue(queue, { sort: 'value' }).map((d) => d.id)).toEqual(['2', '3', '1']);
  });
  it('filters by reason code and keeps the sort', () => {
    expect(sortAndFilterQueue(queue, { sort: 'sla', reason: 'Damaged' }).map((d) => d.id)).toEqual(['3', '1']);
    expect(sortAndFilterQueue(queue, { sort: 'sla', reason: 'Other' })).toEqual([]);
  });
  it('does not mutate the input order', () => {
    sortAndFilterQueue(queue, { sort: 'value' });
    expect(queue.map((d) => d.id)).toEqual(['1', '2', '3']);
  });
});
