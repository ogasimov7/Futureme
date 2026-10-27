import { addDays, daysBetween, weekdayOf } from './dates';
import type { LocalDate, Mission, MissionCompletion } from './types';

export function isScheduledOn(mission: Pick<Mission, 'days'>, date: LocalDate): boolean {
  return mission.days.includes(weekdayOf(date));
}

/**
 * Consecutive scheduled days completed, counting back from `today`.
 * Days the mission is not scheduled are skipped, so a Mon/Wed/Fri habit is not broken
 * by an empty Tuesday. If today is scheduled but not done yet, the streak is still alive
 * (the day isn't over), so counting starts from the previous scheduled day.
 */
export function currentStreak(
  mission: Pick<Mission, 'days'>,
  completedDates: ReadonlySet<LocalDate>,
  today: LocalDate,
  /** The local day the mission was created; nothing before it can break a streak. */
  createdOn: LocalDate,
): number {
  if (mission.days.length === 0) return 0;
  let streak = 0;
  let day = today;
  if (isScheduledOn(mission, day) && !completedDates.has(day)) day = addDays(day, -1);
  while (daysBetween(createdOn, day) >= 0) {
    if (isScheduledOn(mission, day)) {
      if (!completedDates.has(day)) break;
      streak += 1;
    }
    day = addDays(day, -1);
  }
  return streak;
}

/** Longest run of consecutive scheduled days completed between `from` and `to`, inclusive. */
export function longestStreak(
  mission: Pick<Mission, 'days'>,
  completedDates: ReadonlySet<LocalDate>,
  from: LocalDate,
  to: LocalDate,
): number {
  let best = 0;
  let run = 0;
  for (let day = from; daysBetween(day, to) >= 0; day = addDays(day, 1)) {
    if (!isScheduledOn(mission, day)) continue;
    if (completedDates.has(day)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function completionDatesFor(missionId: string, completions: readonly MissionCompletion[]) {
  return new Set(completions.filter((c) => c.missionId === missionId).map((c) => c.localDate));
}
