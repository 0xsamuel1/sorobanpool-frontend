import { describe, expect, it } from 'vitest';
import { checkParam, draftIsValid, paramChanges, type ParamSpec } from './params';

const fee: ParamSpec = { key: 'fee', label: 'Platform fee', value: 200, min: 0, max: 500, unit: 'bps' };
const window_: ParamSpec = { key: 'window', label: 'Window', value: 7, min: 1, max: 30, unit: 'days' };

describe('checkParam', () => {
  it('accepts values inside the hard caps, including the edges', () => {
    expect(checkParam(fee, '0')).toEqual({ ok: true, value: 0 });
    expect(checkParam(fee, ' 500 ')).toEqual({ ok: true, value: 500 });
  });
  it('rejects values past either cap', () => {
    expect(checkParam(fee, '501')).toEqual({ ok: false, error: 'ABOVE_CAP' });
    expect(checkParam(window_, '0')).toEqual({ ok: false, error: 'BELOW_CAP' });
  });
  it('rejects empty and non-numeric input', () => {
    expect(checkParam(fee, '')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    expect(checkParam(fee, 'abc')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
    expect(checkParam(fee, 'Infinity')).toEqual({ ok: false, error: 'NOT_A_NUMBER' });
  });
});

describe('paramChanges', () => {
  it('lists only valid fields whose value differs from the current one', () => {
    const changes = paramChanges([fee, window_], { fee: '300', window: '7' });
    expect(changes).toEqual([{ key: 'fee', label: 'Platform fee', unit: 'bps', from: 200, to: 300 }]);
  });
  it('leaves out invalid edits so they are never proposed', () => {
    expect(paramChanges([fee], { fee: '900' })).toEqual([]);
  });
});

describe('draftIsValid', () => {
  it('is false as soon as one edited field is out of range', () => {
    expect(draftIsValid([fee, window_], { fee: '300', window: '7' })).toBe(true);
    expect(draftIsValid([fee, window_], { fee: '300', window: '31' })).toBe(false);
  });
});
