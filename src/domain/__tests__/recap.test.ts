import { awardsFor, computeWeekStats, scoreWeek, verdictFor } from '../recap';
import type { FocusSession, Mission, MissionCompletion, Weekday } from '../types';

const tz = 'UTC';
const weekStart = '2026-10-19'; // Monday
const daily: Mission = {
  id: 'm1',
  goalId: null,
  title: 'Stretch',
  days: [0, 1, 2, 3, 4, 5, 6] as Weekday[],
  createdAt: '2026-10-01T08:00:00Z',
  archivedAt: null,
};
const weekdays: Mission = { ...daily, id: 'm2', title: 'Commit', days: [1, 2, 3, 4, 5] };

const done = (missionId: string, localDate: string): MissionCompletion => ({
  id: `${missionId}-${localDate}`,
  missionId,
  localDate,
  completedAt: `${localDate}T18:00:00Z`,
});
const focus = (startedAt: string, minutes: number): FocusSession => ({
  id: startedAt,
  startedAt,
  endedAt: startedAt,
  plannedMinutes: minutes,
  actualMinutes: minutes,
});

describe('computeWeekStats', () => {
  it('counts scheduled vs completed missions from recorded data only', () => {
    const stats = computeWeekStats({
      weekStart,
      today: '2026-10-27',
      timeZone: tz,
      missions: [daily, weekdays],
      completions: [done('m1', '2026-10-19'), done('m2', '2026-10-19'), done('m1', '2026-10-25'), done('m1', '2026-10-26')],
      focusSessions: [focus('2026-10-20T10:00:00Z', 50), focus('2026-10-26T10:00:00Z', 25)],
    });
    expect(stats.scheduled).toBe(12); // 7 daily + 5 weekdays
    expect(stats.completed).toBe(3); // the 26th is outside the week
    expect(stats.perfectDays).toBe(2); // Monday (both) and Sunday (daily only scheduled)
    expect(stats.focusMinutes).toBe(50);
    expect(stats.longestFocusMinutes).toBe(50);
    expect(stats.bestDay).toEqual({ date: '2026-10-19', completed: 2 });
    expect(stats.activeDays).toBe(3); // Mon (missions), Tue (focus), Sun (mission)
  });

  it('does not count days that have not happened yet', () => {
    const stats = computeWeekStats({ weekStart, today: '2026-10-21', timeZone: tz, missions: [daily], completions: [], focusSessions: [] });
    expect(stats.countedThrough).toBe('2026-10-21');
    expect(stats.scheduled).toBe(3);
  });

  it('ignores missions before they were created', () => {
    const late = { ...daily, createdAt: '2026-10-24T08:00:00Z' };
    const stats = computeWeekStats({ weekStart, today: '2026-10-27', timeZone: tz, missions: [late], completions: [], focusSessions: [] });
    expect(stats.scheduled).toBe(2); // Sat + Sun
  });
});

describe('scoreWeek and verdicts', () => {
  const base = computeWeekStats({ weekStart, today: '2026-10-27', timeZone: tz, missions: [], completions: [], focusSessions: [] });

  it('refuses to judge an empty week', () => {
    expect(scoreWeek(base)).toBeNull();
    expect(verdictFor(null).id).toBe('dismissed');
  });

  it('weights missions 70% and focus 30%', () => {
    expect(scoreWeek({ ...base, scheduled: 10, completed: 5, completionRate: 0.5, focusMinutes: 75 })).toBe(50);
    expect(scoreWeek({ ...base, scheduled: 10, completed: 10, completionRate: 1, focusMinutes: 999 })).toBe(100);
  });

  it('uses focus alone when nothing was scheduled', () => {
    expect(scoreWeek({ ...base, focusMinutes: 75 })).toBe(50);
  });

  it('maps scores to tiers', () => {
    expect(verdictFor(90).id).toBe('honors');
    expect(verdictFor(70).id).toBe('acquitted');
    expect(verdictFor(50).id).toBe('hung');
    expect(verdictFor(20).id).toBe('mild');
    expect(verdictFor(5).id).toBe('guilty');
  });

  it('awards only what the stats support', () => {
    const awards = awardsFor({
      ...base,
      perfectDays: 1,
      longestFocusMinutes: 44,
      focusMinutes: 150,
      activeDays: 4,
      weekendMissionDays: 2,
      regretSkips: 0,
    });
    const earned = Object.fromEntries(awards.map((a) => [a.id, a.earned]));
    expect(earned).toEqual({
      'perfect-day': true,
      'deep-diver': false,
      'focus-fiend': true,
      'consistency-goblin': false,
      'weekend-warrior': true,
      'wise-refusal': false,
    });
  });
});

describe('regret checks in the week', () => {
  it('counts checks and skipped impulses inside the week only', () => {
    const check = (createdAt: string, outcome: 'skipped' | 'did_it' | null) => ({
      id: createdAt,
      text: 'x',
      category: 'other' as const,
      regret: 50,
      verdict: '',
      parallel: null,
      personality: 'sarcastic' as const,
      createdAt,
      outcome,
    });
    const stats = computeWeekStats({
      weekStart,
      today: '2026-10-27',
      timeZone: tz,
      missions: [],
      completions: [],
      focusSessions: [],
      regretChecks: [check('2026-10-20T12:00:00Z', 'skipped'), check('2026-10-21T12:00:00Z', 'did_it'), check('2026-10-27T12:00:00Z', 'skipped')],
    });
    expect(stats.regretChecks).toBe(2);
    expect(stats.regretSkips).toBe(1);
    expect(awardsFor(stats).find((a) => a.id === 'wise-refusal')?.earned).toBe(true);
  });
});
