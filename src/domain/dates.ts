import type { LocalDate, Weekday } from './types';

const DAY_MS = 86_400_000;

const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function dateKeyFormatter(timeZone: string) {
  let f = dateKeyFormatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    dateKeyFormatters.set(timeZone, f);
  }
  return f;
}

/** The calendar day ('YYYY-MM-DD') that `instant` falls on in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const parts = dateKeyFormatter(timeZone).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function parseLocalDate(date: LocalDate) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

/** Pure calendar arithmetic on a LocalDate; no time zone involved. */
export function addDays(date: LocalDate, days: number): LocalDate {
  const { y, m, d } = parseLocalDate(date);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

export function weekdayOf(date: LocalDate): Weekday {
  const { y, m, d } = parseLocalDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() as Weekday;
}

/** Monday of the ISO week containing `date`. */
export function startOfIsoWeek(date: LocalDate): LocalDate {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export function daysBetween(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / DAY_MS);
}

/** Offset of `timeZone` from UTC at `instant`, in minutes (e.g. +60 for CET in winter). */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  });
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/**
 * The UTC instant for wall-clock `hour:minute` on `date` in `timeZone`.
 * Ambiguous times (fall-back overlap) resolve to the first occurrence. Times that do not
 * exist (spring-forward gap) move forward by the size of the gap, like most calendars.
 */
export function zonedTimeToUtc(date: LocalDate, hour: number, minute: number, timeZone: string): Date {
  const { y, m, d } = parseLocalDate(date);
  const naive = Date.UTC(y, m - 1, d, hour, minute);
  // Offsets either side of any transition that could affect this wall time.
  const offsets = new Set([
    zoneOffsetMinutes(new Date(naive - 14 * 3_600_000), timeZone),
    zoneOffsetMinutes(new Date(naive + 14 * 3_600_000), timeZone),
  ]);
  const candidates = [...offsets].map((o) => ({ o, t: naive - o * 60_000 }));
  const valid = candidates.filter(({ o, t }) => zoneOffsetMinutes(new Date(t), timeZone) === o);
  if (valid.length > 0) return new Date(Math.min(...valid.map((c) => c.t)));
  return new Date(Math.max(...candidates.map((c) => c.t)));
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}
