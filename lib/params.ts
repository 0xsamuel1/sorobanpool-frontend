/** A parameter the contract manages. `min` and `max` are the hard caps: the app never lets an edit go past them. */
export interface ParamSpec {
  key: string;
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
}

export type ParamError = 'NOT_A_NUMBER' | 'BELOW_CAP' | 'ABOVE_CAP';
export type ParamCheck = { ok: true; value: number } | { ok: false; error: ParamError };

/** Checks a typed value against its hard caps. Empty or non-numeric input is rejected. */
export function checkParam(spec: ParamSpec, raw: string): ParamCheck {
  const text = raw.trim();
  const value = text === '' ? Number.NaN : Number(text);
  if (!Number.isFinite(value)) return { ok: false, error: 'NOT_A_NUMBER' };
  if (value < spec.min) return { ok: false, error: 'BELOW_CAP' };
  if (value > spec.max) return { ok: false, error: 'ABOVE_CAP' };
  return { ok: true, value };
}

export interface ParamChange {
  key: string;
  label: string;
  unit: string;
  from: number;
  to: number;
}

/** Every parameter whose valid typed value differs from the current one. Invalid or unchanged fields are left out. */
export function paramChanges(specs: ParamSpec[], draft: Record<string, string>): ParamChange[] {
  return specs.flatMap((spec) => {
    const raw = draft[spec.key];
    if (raw === undefined) return [];
    const check = checkParam(spec, raw);
    if (!check.ok || check.value === spec.value) return [];
    return [{ key: spec.key, label: spec.label, unit: spec.unit, from: spec.value, to: check.value }];
  });
}

/** True when every edited field passes its cap check. */
export function draftIsValid(specs: ParamSpec[], draft: Record<string, string>): boolean {
  return specs.every((spec) => {
    const raw = draft[spec.key];
    return raw === undefined || checkParam(spec, raw).ok;
  });
}
