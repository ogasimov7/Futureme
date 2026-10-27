import { addDays, daysBetween, localDateOf, startOfIsoWeek, weekdayOf, zonedTimeToUtc } from '../dates';

describe('localDateOf', () => {
  it('uses the given zone, not UTC', () => {
    const instant = new Date('2026-10-27T23:30:00Z');
    expect(localDateOf(instant, 'UTC')).toBe('2026-10-27');
    expect(localDateOf(instant, 'Asia/Tokyo')).toBe('2026-10-28');
    expect(localDateOf(instant, 'America/Los_Angeles')).toBe('2026-10-27');
  });
});

describe('calendar arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('finds weekdays and ISO week starts', () => {
    expect(weekdayOf('2026-10-27')).toBe(2); // Tuesday
    expect(startOfIsoWeek('2026-10-27')).toBe('2026-10-26');
    expect(startOfIsoWeek('2026-11-01')).toBe('2026-10-26'); // Sunday belongs to the previous Monday
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-01', '2026-10-27')).toBe(26);
    expect(daysBetween('2026-10-27', '2026-10-01')).toBe(-26);
  });
});

describe('zonedTimeToUtc', () => {
  it('converts wall time in standard and daylight time', () => {
    expect(zonedTimeToUtc('2027-01-15', 9, 0, 'Europe/Berlin').toISOString()).toBe('2027-01-15T08:00:00.000Z');
    expect(zonedTimeToUtc('2027-07-15', 9, 0, 'Europe/Berlin').toISOString()).toBe('2027-07-15T07:00:00.000Z');
    expect(zonedTimeToUtc('2027-07-15', 9, 0, 'Asia/Kolkata').toISOString()).toBe('2027-07-15T03:30:00.000Z');
  });

  it('moves times in a spring-forward gap forward', () => {
    // New York skips 02:00–03:00 on 2027-03-14; 02:30 does not exist and becomes 03:30 EDT.
    expect(zonedTimeToUtc('2027-03-14', 2, 30, 'America/New_York').toISOString()).toBe('2027-03-14T07:30:00.000Z');
  });

  it('picks the first occurrence of an ambiguous fall-back time', () => {
    // 01:30 happens twice in New York on 2027-11-07; the first is EDT (UTC-4).
    expect(zonedTimeToUtc('2027-11-07', 1, 30, 'America/New_York').toISOString()).toBe('2027-11-07T05:30:00.000Z');
  });
});
