import type { Unit } from '../types';

export function waistUnit(units: Unit): 'in' | 'cm' {
  return units === 'lb' ? 'in' : 'cm';
}

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return Number.isInteger(r) ? String(r) : r.toFixed(digits);
}

export function signed(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return '—';
  const s = fmt(Math.abs(n), digits);
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
}

export function heightLabel(cm: number | undefined, units: Unit): string {
  if (!cm) return '—';
  if (units === 'kg') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cm / 2.54);
  return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`;
}
