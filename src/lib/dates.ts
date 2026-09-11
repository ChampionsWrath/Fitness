export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Monday-based week start. */
export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(iso, -dow);
}

export function weekdayOf(iso: string): number {
  return parseISO(iso).getDay();
}

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  return parseISO(iso).toLocaleDateString(undefined, opts);
}

export function formatDateLong(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function monthLabel(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
