/**
 * Azerbaijani display formatting. Month and weekday names are spelled out here instead of
 * relying on Intl locale data, because `az` support varies between Hermes builds.
 */
import { localDateOf, weekdayOf } from '@/domain/dates';

const MONTHS_LONG = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avq', 'sen', 'okt', 'noy', 'dek'];
// Index 0 = Sunday, matching weekdayOf.
const WEEKDAYS_LONG = ['bazar', 'bazar ertəsi', 'çərşənbə axşamı', 'çərşənbə', 'cümə axşamı', 'cümə', 'şənbə'];
const WEEKDAYS_SHORT = ['B.', 'B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.'];

export const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('az') + s.slice(1);

export function weekdayName(date: string, style: 'long' | 'short' = 'long') {
  return (style === 'long' ? WEEKDAYS_LONG : WEEKDAYS_SHORT)[weekdayOf(date)];
}

type DateOpts = { weekday?: 'long' | 'short'; month?: 'long' | 'short'; year?: boolean };

/** "27 okt", "Çərşənbə axşamı, 27 oktyabr 2026" … for a calendar day (YYYY-MM-DD). */
export function formatLocalDate(date: string, { weekday, month = 'short', year = false }: DateOpts = {}) {
  const [y, m, d] = date.split('-').map(Number);
  const core = `${d} ${(month === 'long' ? MONTHS_LONG : MONTHS_SHORT)[m - 1]}${year ? ` ${y}` : ''}`;
  return weekday ? `${capitalize(weekdayName(date, weekday))}, ${core}` : core;
}

/** Formats an instant as a calendar day in `timeZone`. Includes the year by default. */
export function formatDate(instant: string | Date, timeZone: string, opts: DateOpts = {}) {
  const date = localDateOf(typeof instant === 'string' ? new Date(instant) : instant, timeZone);
  return formatLocalDate(date, { year: true, ...opts });
}

/** "3 gün sonra", "6 ay əvvəl". Azerbaijani nouns stay singular after numbers. */
export function relativeTime(target: Date, now: Date) {
  const diff = target.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const units: [number, string][] = [
    [365 * day, 'il'],
    [30 * day, 'ay'],
    [7 * day, 'həftə'],
    [day, 'gün'],
    [hour, 'saat'],
    [minute, 'dəqiqə'],
  ];
  const [size, unit] = units.find(([u]) => abs >= u) ?? [minute, 'dəqiqə'];
  const n = Math.max(1, Math.round(abs / size));
  return diff >= 0 ? `${n} ${unit} sonra` : `${n} ${unit} əvvəl`;
}

/**
 * Ordinal suffix for a number, following vowel harmony on how the number is read aloud:
 * 2031-ci, 2033-cü, 2030-cu, 2036-cı.
 */
export function ordinalSuffix(n: number): string {
  const lastDigit = n % 10;
  if (lastDigit !== 0) return ['', 'ci', 'ci', 'cü', 'cü', 'ci', 'cı', 'ci', 'ci', 'cu'][lastDigit];
  const tens = Math.floor(n / 10) % 10;
  if (tens !== 0) return ['', 'cu', 'ci', 'cu', 'cı', 'ci', 'cı', 'ci', 'ci', 'cı'][tens];
  if (Math.floor(n / 100) % 10 !== 0) return 'cü'; // yüz
  return 'ci'; // min
}

/** "2031-ci ildən" — where future you is writing from. */
export const fromYear = (year: number) => `${year}-${ordinalSuffix(year)} ildən`;

export function greeting(hour: number) {
  if (hour < 5) return 'Gecə yarısı oyaqsan';
  if (hour < 12) return 'Sabahın xeyir';
  if (hour < 18) return 'Günortan xeyir';
  return 'Axşamın xeyir';
}

export function hourIn(timeZone: string, now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now));
}
