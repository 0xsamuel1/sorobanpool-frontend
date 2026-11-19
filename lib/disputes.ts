/** Pure helpers for the dispute screens. Amounts are USDC stroops (bigint). */
import { toStroops } from './format';
import type { DisputeView } from './types';

export type OutcomeKind = 'ReleaseToSupplier' | 'RefundMember' | 'Split' | 'RefundPool';

export interface OutcomeInput {
  kind: OutcomeKind;
  units?: number; // RefundMember
  bp?: number; // Split: basis points to the buyer side
}

/** What each side receives, mirroring the contract (disputes.resolve): the buyer-side share floors, the supplier gets the rest. */
export function outcomePreview(claimed: bigint, finalPrice: bigint, o: OutcomeInput): { buyer: bigint; supplier: bigint } {
  switch (o.kind) {
    case 'ReleaseToSupplier': return { buyer: 0n, supplier: claimed };
    case 'RefundPool': return { buyer: claimed, supplier: 0n };
    case 'RefundMember': {
      const buyer = BigInt(Math.max(0, o.units ?? 0)) * finalPrice;
      const capped = buyer > claimed ? claimed : buyer;
      return { buyer: capped, supplier: claimed - capped };
    }
    case 'Split': {
      const bp = BigInt(Math.min(10_000, Math.max(0, o.bp ?? 0)));
      const buyer = (claimed * bp) / 10_000n;
      return { buyer, supplier: claimed - buyer };
    }
  }
}

/** Hours left to decide, never negative. */
export const hoursLeft = (slaDueAt: string | Date, now: number): number => Math.max(0, Math.ceil((new Date(slaDueAt).getTime() - now) / 3_600_000));

/** USDC per unit shown to a supplier typing naira prices: floor, like the backend conversion. */
export function nairaToUsdcStroops(priceNgn: bigint, ngnPerUsd: number): bigint {
  const rate = BigInt(Math.round(ngnPerUsd * 1_000_000));
  return (priceNgn * 10_000_000n * 1_000_000n) / rate;
}

/** Reason codes a buyer can give when opening a dispute (same list as the report form). */
export const DISPUTE_REASONS = ['Short', 'WrongItem', 'Damaged', 'Quality', 'NotDelivered', 'Other'] as const;

export type QueueSort = 'sla' | 'value';

/** The decision time has passed: msToSla is missing or not positive. */
export const slaBreached = (d: Pick<DisputeView, 'msToSla'>): boolean => (d.msToSla ?? 0) <= 0;

/**
 * Keep only the chosen reason (empty means all), then sort. `sla` puts the least time left first (breached first);
 * `value` puts the largest claim first.
 */
export function sortAndFilterQueue(items: readonly DisputeView[], o: { sort: QueueSort; reason?: string }): DisputeView[] {
  const rows = items.filter((d) => !o.reason || d.reasonCode === o.reason);
  if (o.sort === 'value') {
    return rows.sort((a, b) => {
      const va = toStroops(a.claimedAmount);
      const vb = toStroops(b.claimedAmount);
      return va === vb ? 0 : va < vb ? 1 : -1;
    });
  }
  return rows.sort((a, b) => (a.msToSla ?? 0) - (b.msToSla ?? 0));
}

/** One item of dispute evidence. `party` says whose submission it is (opener, supplier or organizer). */
export interface EvidenceItem {
  id: string;
  kind: string;
  mime: string;
  createdAt: string;
  party?: 'opener' | 'supplier' | 'organizer';
}

/** One chronological list across all parties. Items with the same time keep a stable order by id. */
export function evidenceTimeline<T extends EvidenceItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}
