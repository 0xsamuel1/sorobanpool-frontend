// @vitest-environment node
import { Address, Keypair, StrKey, xdr } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';
import { assertSafeAuth, type Deployment } from './verify';

/**
 * Table-driven signing guard matrix (issue #150). Every prepared action the app can sign is checked against the
 * contract and function the screen asked for. A wrong contract or function name must be refused, and so must a
 * transfer that leaves SorobanPool or exceeds the amount the screen showed.
 */

const user = Keypair.random().publicKey();
const addr = (n: number) => StrKey.encodeContract(Buffer.alloc(32, n));
const deployment: Deployment = {
  usdc: addr(1),
  contracts: { group_buy: addr(2), disputes: addr(3), supplier_bond: addr(4), config: addr(5) },
};
const outsider = addr(99);

type Call = { contract: string; fn: string; args?: xdr.ScVal[] };

const invocation = (c: Call, subs: xdr.SorobanAuthorizedInvocation[] = []) =>
  new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({ contractAddress: new Address(c.contract).toScAddress(), functionName: c.fn, args: c.args ?? [] }),
    ),
    subInvocations: subs,
  });

/** One user-owned authorization entry whose root call is `root`, with the given nested calls. */
function entry(root: Call, subs: xdr.SorobanAuthorizedInvocation[] = []): string {
  const creds = new xdr.SorobanAddressCredentials({ address: new Address(user).toScAddress(), nonce: 1n as never, signatureExpirationLedger: 0, signature: xdr.ScVal.scvVoid() });
  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(creds),
    rootInvocation: invocation(root, subs),
  }).toXDR('base64');
}

const transfer = (to: string, amount: bigint): xdr.SorobanAuthorizedInvocation =>
  invocation({
    contract: deployment.usdc,
    fn: 'transfer',
    args: [
      new Address(user).toScVal(),
      new Address(to).toScVal(),
      xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: xdr.Int64.fromString('0'), lo: xdr.Uint64.fromString(amount.toString()) })),
    ],
  });

type Case = {
  name: string;
  asked: { contract: string; fn: string };
  entries: string[];
  maxTransfer?: bigint;
  /** null = the guard must accept the request; otherwise a substring the refusal reason must contain. */
  refuse: string | null;
};

/** Every prepared action the app signs, against the call it is expected to be. */
const actions: { action: string; contract: string; fn: string }[] = [
  { action: 'pool commit', contract: 'group_buy', fn: 'commit' },
  { action: 'pool accept', contract: 'group_buy', fn: 'accept' },
  { action: 'pool dispatch', contract: 'group_buy', fn: 'dispatch' },
  { action: 'supplier bond deposit', contract: 'supplier_bond', fn: 'deposit' },
  { action: 'supplier bond withdraw', contract: 'supplier_bond', fn: 'withdraw' },
  { action: 'dispute open', contract: 'disputes', fn: 'open' },
  { action: 'dispute evidence', contract: 'disputes', fn: 'add_evidence' },
];

const cases: Case[] = [];

for (const a of actions) {
  const asked = { contract: a.contract, fn: a.fn };
  const amount = 5_000_000n; // 0.5 USDC
  cases.push(
    { name: `${a.action}: exact call is accepted`, asked, entries: [entry({ contract: deployment.contracts[a.contract]!, fn: a.fn })], refuse: null },
    { name: `${a.action}: wrong function name is refused`, asked, entries: [entry({ contract: deployment.contracts[a.contract]!, fn: `${a.fn}_x` })], refuse: 'expected' },
    { name: `${a.action}: wrong contract is refused`, asked, entries: [entry({ contract: outsider, fn: a.fn })], refuse: 'expected' },
    { name: `${a.action}: wrong contract, same function name, is refused`, asked, entries: [entry({ contract: deployment.contracts.config!, fn: a.fn })], refuse: 'expected' },
    {
      name: `${a.action}: transfer to a SorobanPool contract within the cap is accepted`,
      asked,
      entries: [entry({ contract: deployment.contracts[a.contract]!, fn: a.fn }, [transfer(deployment.contracts.group_buy!, amount)])],
      maxTransfer: amount,
      refuse: null,
    },
    {
      name: `${a.action}: transfer to an outside address is refused`,
      asked,
      entries: [entry({ contract: deployment.contracts[a.contract]!, fn: a.fn }, [transfer(outsider, amount)])],
      maxTransfer: amount,
      refuse: 'outside SorobanPool',
    },
    {
      name: `${a.action}: transfer above the amount shown is refused`,
      asked,
      entries: [entry({ contract: deployment.contracts[a.contract]!, fn: a.fn }, [transfer(deployment.contracts.group_buy!, amount + 1n)])],
      maxTransfer: amount,
      refuse: 'larger than the amount shown',
    },
  );
}

describe('signing guard matrix: every prepared action', () => {
  for (const c of cases) {
    it(c.name, () => {
      const run = () => assertSafeAuth(c.entries, { user, contract: c.asked.contract, fn: c.asked.fn, maxTransfer: c.maxTransfer }, deployment);
      if (c.refuse === null) {
        expect(run).not.toThrow();
      } else {
        expect(run).toThrow(c.refuse);
      }
    });
  }

  it('refuses an entry that is not the user’s, leaving nothing to sign', () => {
    const other = Keypair.random().publicKey();
    const creds = new xdr.SorobanAddressCredentials({ address: new Address(other).toScAddress(), nonce: 1n as never, signatureExpirationLedger: 0, signature: xdr.ScVal.scvVoid() });
    const e = new xdr.SorobanAuthorizationEntry({
      credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(creds),
      rootInvocation: invocation({ contract: deployment.contracts.group_buy!, fn: 'commit' }),
    }).toXDR('base64');
    expect(() => assertSafeAuth([e], { user, contract: 'group_buy', fn: 'commit' }, deployment)).toThrow('nothing in this request needs your approval');
  });

  it('refuses an unknown logical contract name', () => {
    expect(() => assertSafeAuth([entry({ contract: deployment.contracts.group_buy!, fn: 'commit' })], { user, contract: 'nope', fn: 'commit' }, deployment)).toThrow('unknown contract nope');
  });
});
