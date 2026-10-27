import { localDateOf, startOfIsoWeek } from '@/domain/dates';
import { isDelivered } from '@/domain/letters';
import { computeWeekStats } from '@/domain/recap';
import { completionDatesFor, currentStreak, isScheduledOn } from '@/domain/streaks';
import type { LocalDate, Mission } from '@/domain/types';

import type { Snapshot } from './repository';

export type MissionView = { mission: Mission; done: boolean; streak: number; scheduledToday: boolean };

export function activeMissions(data: Snapshot) {
  return data.missions.filter((m) => !m.archivedAt);
}

export function missionViews(data: Snapshot, today: LocalDate): MissionView[] {
  const tz = data.profile.timeZone;
  return activeMissions(data).map((mission) => {
    const dates = completionDatesFor(mission.id, data.completions);
    return {
      mission,
      done: dates.has(today),
      streak: currentStreak(mission, dates, today, localDateOf(new Date(mission.createdAt), tz)),
      scheduledToday: isScheduledOn(mission, today),
    };
  });
}

export function todaysMissions(data: Snapshot, today: LocalDate) {
  return missionViews(data, today).filter((v) => v.scheduledToday);
}

export function weekStats(data: Snapshot, today: LocalDate, weekStart = startOfIsoWeek(today)) {
  return computeWeekStats({
    weekStart,
    today,
    timeZone: data.profile.timeZone,
    missions: data.missions,
    completions: data.completions,
    focusSessions: data.focusSessions,
    regretChecks: data.regretChecks,
  });
}

export function splitLetters(data: Snapshot, now: Date) {
  const byDeliverAt = [...data.letters].sort((a, b) => a.deliverAt.localeCompare(b.deliverAt));
  return {
    sealed: byDeliverAt.filter((l) => !isDelivered(l, now)),
    delivered: byDeliverAt.filter((l) => isDelivered(l, now)).reverse(),
  };
}
