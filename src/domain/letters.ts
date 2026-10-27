import { addDays, localDateOf, zonedTimeToUtc } from './dates';
import type { Letter, LocalDate } from './types';

/** Letters unlock at this local hour on the chosen delivery date. */
export const DELIVERY_HOUR = 9;

export const LETTER_LIMITS = {
  titleMax: 80,
  bodyMin: 20,
  bodyMax: 10_000,
  minDaysAhead: 1,
  maxYearsAhead: 25,
} as const;

export type DeliveryPreset = { id: string; label: string; months: number };

export const DELIVERY_PRESETS: readonly DeliveryPreset[] = [
  { id: '1m', label: '1 ay', months: 1 },
  { id: '3m', label: '3 ay', months: 3 },
  { id: '6m', label: '6 ay', months: 6 },
  { id: '1y', label: '1 il', months: 12 },
  { id: '5y', label: '5 il', months: 60 },
];

/** Adds calendar months, clamping to the last day of the month (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(date: LocalDate, months: number): LocalDate {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function deliveryInstant(date: LocalDate, timeZone: string): Date {
  return zonedTimeToUtc(date, DELIVERY_HOUR, 0, timeZone);
}

/**
 * Whether a letter's content may be shown. The server enforces the same rule with RLS
 * (see letter_contents policy); this copy only drives the UI.
 */
export function isDelivered(letter: Pick<Letter, 'deliverAt'>, now: Date): boolean {
  return new Date(letter.deliverAt).getTime() <= now.getTime();
}

export type LetterDraft = { title: string; body: string; deliverOn: LocalDate | null };
export type LetterDraftErrors = Partial<Record<keyof LetterDraft, string>>;

export function validateLetterDraft(draft: LetterDraft, now: Date, timeZone: string): LetterDraftErrors {
  const errors: LetterDraftErrors = {};
  const title = draft.title.trim();
  const body = draft.body.trim();
  if (title.length > LETTER_LIMITS.titleMax) {
    errors.title = `Başlıq ${LETTER_LIMITS.titleMax} simvoldan qısa olmalıdır.`;
  }
  if (body.length < LETTER_LIMITS.bodyMin) {
    errors.body = `Ən azı ${LETTER_LIMITS.bodyMin} simvol yaz. Gələcəkdəki sən tam bir cümləyə layiqdir.`;
  } else if (body.length > LETTER_LIMITS.bodyMax) {
    errors.body = `Məktub ən çox ${LETTER_LIMITS.bodyMax} simvol ola bilər.`;
  }
  if (!draft.deliverOn) {
    errors.deliverOn = 'Məktubun nə vaxt açılacağını seç.';
  } else {
    const today = localDateOf(now, timeZone);
    const earliest = addDays(today, LETTER_LIMITS.minDaysAhead);
    const latest = addMonths(today, LETTER_LIMITS.maxYearsAhead * 12);
    if (draft.deliverOn < earliest) errors.deliverOn = 'Məktubun yola düşməsi üçün ən azı bir gün lazımdır.';
    else if (draft.deliverOn > latest) errors.deliverOn = `Poçt ən çox ${LETTER_LIMITS.maxYearsAhead} il irəli gedir.`;
  }
  return errors;
}
