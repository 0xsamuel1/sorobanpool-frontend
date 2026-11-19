import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderIntl } from '@/tests/render';
import { formatNaira, stroopsToNairaCeil } from '@/lib/format';
import type { PoolView } from '@/lib/types';

vi.mock('@/lib/api', async (orig) => ({ ...(await orig<typeof import('@/lib/api')>()), api: vi.fn(async () => ({})) }));
vi.mock('@/lib/tx', async (orig) => ({ ...(await orig<typeof import('@/lib/tx')>()), runAction: vi.fn() }));

import { JoinPanel } from './JoinPanel';

/** Fixed rate so the expected naira amounts never move with the market. */
const RATE = 1500;
const SUBSET = 100;

interface Vector { tiers: [number, number][]; units: number[]; paid: string[] }
const vectors: Vector[] = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/pricing-vectors.json'), 'utf8')).vectors;

describe('JoinPanel shows the contract amounts for pricing vectors', () => {
  it(`renders ${SUBSET} vectors and matches the expected naira maximum`, () => {
    vectors.slice(0, SUBSET).forEach((v, index) => {
      // Pick one commit per vector, rotating through its commits so later tiers are covered too.
      const commit = index % v.units.length;
      const before = v.units.slice(0, commit).reduce((a, b) => a + b, 0);
      const units = v.units[commit]!;
      const pool = {
        id: '1',
        state: 'Open',
        totalUnits: before,
        maxUnits: 1_000_000_000,
        ngnPerUsd: RATE,
        myCommitment: null,
        tiersUsdc: v.tiers.map(([minUnits, price]) => ({ minUnits, unitPrice: String(price) })),
        offer: { maxPerMember: 1_000_000_000 },
      } as unknown as PoolView;

      const { unmount } = renderIntl(
        <QueryClientProvider client={new QueryClient()}>
          <JoinPanel pool={pool} />
        </QueryClientProvider>,
      );
      fireEvent.change(screen.getByLabelText('How many units?'), { target: { value: String(units) } });

      const expected = formatNaira(stroopsToNairaCeil(BigInt(v.paid[commit]!), RATE));
      const shown = screen.getByTestId('max-now').textContent;
      expect({ vector: index, commit, shown }).toEqual({ vector: index, commit, shown: expected });
      unmount();
    });
  });
});
