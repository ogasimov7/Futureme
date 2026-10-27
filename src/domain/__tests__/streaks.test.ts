import { currentStreak, longestStreak } from '../streaks';
import type { Weekday } from '../types';

const daily = { days: [0, 1, 2, 3, 4, 5, 6] as Weekday[] };
const monWedFri = { days: [1, 3, 5] as Weekday[] };

// 2026-10-26 is a Monday.
describe('currentStreak', () => {
  it('counts consecutive completed days up to today', () => {
    const done = new Set(['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
    expect(currentStreak(daily, done, '2026-10-27', '2026-10-01')).toBe(4);
  });

  it('keeps the streak alive while today is still open', () => {
    const done = new Set(['2026-10-25', '2026-10-26']);
    expect(currentStreak(daily, done, '2026-10-27', '2026-10-01')).toBe(2);
  });

  it('breaks on a missed scheduled day', () => {
    const done = new Set(['2026-10-23', '2026-10-24', '2026-10-26']);
    expect(currentStreak(daily, done, '2026-10-27', '2026-10-01')).toBe(1);
  });

  it('skips unscheduled days', () => {
    // Fri 23, Mon 26, Wed 28 done; Tue/Thu/weekend are not scheduled.
    const done = new Set(['2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28']);
    expect(currentStreak(monWedFri, done, '2026-10-29', '2026-10-01')).toBe(4);
  });

  it('does not count days before the mission existed', () => {
    const done = new Set(['2026-10-26', '2026-10-27']);
    expect(currentStreak(daily, done, '2026-10-27', '2026-10-26')).toBe(2);
  });

  it('is zero for a mission with no days', () => {
    expect(currentStreak({ days: [] }, new Set(['2026-10-27']), '2026-10-27', '2026-10-01')).toBe(0);
  });
});

describe('longestStreak', () => {
  it('finds the longest run in a range', () => {
    const done = new Set(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06']);
    expect(longestStreak(daily, done, '2026-10-01', '2026-10-07')).toBe(3);
  });
});
