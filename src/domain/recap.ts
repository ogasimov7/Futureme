import { addDays, daysBetween, localDateOf } from './dates';
import { isScheduledOn } from './streaks';
import type { FocusSession, LocalDate, Mission, MissionCompletion, RegretCheck } from './types';

/**
 * Future Court. Every number here is computed from recorded activity, nothing is estimated.
 * The scoring rules are exported as plain text so the UI can show exactly how a verdict
 * was reached.
 */

export const FOCUS_TARGET_MINUTES = 150;

export const SCORING_RULES = [
  `Balın 70%-i planlaşdırılmış missiyalardan neçəsini bitirdiyindir.`,
  `30%-i fokus vaxtıdır, həftəlik ${FOCUS_TARGET_MINUTES} dəqiqə ilə məhdudlaşır.`,
  `Missiya planlaşdırılmayıbsa, balın hamısı fokus vaxtından gəlir.`,
  `Yalnız başlamış günlər sayılır. Gələcək günləri hələ buraxa bilməzsən.`,
  `"Peşman olacam?" yoxlamaları bala təsir etmir, yalnız mükafat qazandırır.`,
] as const;

export type WeekStats = {
  weekStart: LocalDate;
  weekEnd: LocalDate;
  /** Last day included in the stats: weekEnd, or today if the week is still running. */
  countedThrough: LocalDate;
  scheduled: number;
  completed: number;
  completionRate: number | null;
  focusMinutes: number;
  focusSessions: number;
  longestFocusMinutes: number;
  perfectDays: number;
  activeDays: number;
  bestDay: { date: LocalDate; completed: number } | null;
  weekendMissionDays: number;
  /** "Peşman olacam?" checks this week, and how many impulses were skipped afterwards. */
  regretChecks: number;
  regretSkips: number;
};

export function computeWeekStats(input: {
  weekStart: LocalDate;
  today: LocalDate;
  timeZone: string;
  missions: readonly Mission[];
  completions: readonly MissionCompletion[];
  focusSessions: readonly FocusSession[];
  regretChecks?: readonly RegretCheck[];
}): WeekStats {
  const { weekStart, today, timeZone, missions, completions, focusSessions, regretChecks = [] } = input;
  const weekEnd = addDays(weekStart, 6);
  const countedThrough = daysBetween(today, weekEnd) > 0 ? today : weekEnd;
  const done = new Set(completions.map((c) => `${c.missionId}|${c.localDate}`));

  let scheduled = 0;
  let completed = 0;
  let perfectDays = 0;
  let weekendMissionDays = 0;
  let bestDay: WeekStats['bestDay'] = null;
  const activeDates = new Set<LocalDate>();

  for (let day = weekStart; daysBetween(day, countedThrough) >= 0; day = addDays(day, 1)) {
    const due = missions.filter((m) => isActiveOn(m, day, timeZone) && isScheduledOn(m, day));
    const doneToday = due.filter((m) => done.has(`${m.id}|${day}`)).length;
    scheduled += due.length;
    completed += doneToday;
    if (due.length > 0 && doneToday === due.length) perfectDays += 1;
    if (doneToday > 0) {
      activeDates.add(day);
      if (!bestDay || doneToday > bestDay.completed) bestDay = { date: day, completed: doneToday };
      const offset = daysBetween(weekStart, day);
      if (offset === 5 || offset === 6) weekendMissionDays += 1;
    }
  }

  const sessions = focusSessions.filter((s) => {
    const d = localDateOf(new Date(s.startedAt), timeZone);
    return daysBetween(weekStart, d) >= 0 && daysBetween(d, countedThrough) >= 0;
  });
  for (const s of sessions) activeDates.add(localDateOf(new Date(s.startedAt), timeZone));
  const checks = regretChecks.filter((c) => {
    const d = localDateOf(new Date(c.createdAt), timeZone);
    return daysBetween(weekStart, d) >= 0 && daysBetween(d, countedThrough) >= 0;
  });

  return {
    weekStart,
    weekEnd,
    countedThrough,
    scheduled,
    completed,
    completionRate: scheduled > 0 ? completed / scheduled : null,
    focusMinutes: sessions.reduce((sum, s) => sum + s.actualMinutes, 0),
    focusSessions: sessions.length,
    longestFocusMinutes: sessions.reduce((max, s) => Math.max(max, s.actualMinutes), 0),
    perfectDays,
    activeDays: activeDates.size,
    bestDay,
    weekendMissionDays,
    regretChecks: checks.length,
    regretSkips: checks.filter((c) => c.outcome === 'skipped').length,
  };
}

function isActiveOn(mission: Mission, day: LocalDate, timeZone: string) {
  const created = localDateOf(new Date(mission.createdAt), timeZone);
  if (daysBetween(created, day) < 0) return false;
  if (mission.archivedAt && daysBetween(localDateOf(new Date(mission.archivedAt), timeZone), day) >= 0) {
    return false;
  }
  return true;
}

/** 0–100, or null when there is nothing to judge. */
export function scoreWeek(stats: WeekStats): number | null {
  const focusPart = Math.min(stats.focusMinutes / FOCUS_TARGET_MINUTES, 1);
  if (stats.completionRate === null) {
    return stats.focusMinutes > 0 ? Math.round(100 * focusPart) : null;
  }
  return Math.round(70 * stats.completionRate + 30 * focusPart);
}

export type Verdict = { id: string; title: string; ruling: string };

export function verdictFor(score: number | null): Verdict {
  if (score === null) {
    return {
      id: 'dismissed',
      title: 'İş bağlandı',
      ruling: 'Nə missiya var, nə fokus vaxtı. Məhkəmə kabusu mühakimə edə bilməz.',
    };
  }
  if (score >= 85) {
    return {
      id: 'honors',
      title: 'Fəxri bəraət',
      ruling: 'Məhkəmə bu qədər bacarığa şübhə ilə yanaşır, amma saxtakarlığa dair sübut tapmadı.',
    };
  }
  if (score >= 65) {
    return {
      id: 'acquitted',
      title: 'Bəraət',
      ruling: 'Yaxşı həftə idi. Bir neçə missiya qaçıb, amma münsiflər islah olunacağına inanır.',
    };
  }
  if (score >= 40) {
    return {
      id: 'hung',
      title: 'Münsiflər razılaşmadı',
      ruling: 'Yarısı qəhrəman, yarısı divan. Məhkəmə sabah bir kiçik qələbə tələb edir.',
    };
  }
  if (score >= 15) {
    return {
      id: 'mild',
      title: 'Yüngül süründürməçilikdə təqsirli',
      ruling: 'Hökm: sabah nahara qədər bir missiya. Qəhvədən əvvəl etsən, hökm şərti sayılır.',
    };
  }
  return {
    id: 'guilty',
    title: 'Təqsirli bilinir',
    ruling: 'Çətin həftə idi, amma sən pis insan deyilsən. Hökm: beş dəqiqəlik bir qələbə.',
  };
}

export type Award = { id: string; title: string; criteria: string; earned: boolean; detail: string };

export function awardsFor(stats: WeekStats): Award[] {
  return [
    {
      id: 'perfect-day',
      title: 'Qüsursuz qələbə',
      criteria: 'Ən azı bir gün bütün missiyaları bitir.',
      earned: stats.perfectDays > 0,
      detail: `${stats.perfectDays} mükəmməl gün`,
    },
    {
      id: 'deep-diver',
      title: 'Dərin dalğıc',
      criteria: 'Bir dəfəyə 45+ dəqiqəlik fokus sessiyası.',
      earned: stats.longestFocusMinutes >= 45,
      detail: `Ən uzun: ${stats.longestFocusMinutes} dəq`,
    },
    {
      id: 'focus-fiend',
      title: 'Fokus canavarı',
      criteria: `Həftədə ${FOCUS_TARGET_MINUTES}+ dəqiqə fokus.`,
      earned: stats.focusMinutes >= FOCUS_TARGET_MINUTES,
      detail: `${stats.focusMinutes}/${FOCUS_TARGET_MINUTES} dəq`,
    },
    {
      id: 'consistency-goblin',
      title: 'Ardıcıllıq qoblini',
      criteria: '5 və ya daha çox gün aktiv ol.',
      earned: stats.activeDays >= 5,
      detail: `${stats.activeDays} aktiv gün`,
    },
    {
      id: 'weekend-warrior',
      title: 'Həftəsonu döyüşçüsü',
      criteria: 'Həm şənbə, həm bazar bir missiya bitir.',
      earned: stats.weekendMissionDays >= 2,
      detail: `${stats.weekendMissionDays}/2 həftəsonu günü`,
    },
    {
      id: 'wise-refusal',
      title: 'Ağıllı imtina',
      criteria: '"Peşman olacam?" hökmündən sonra impulsdan imtina et.',
      earned: stats.regretSkips > 0,
      detail: `${stats.regretSkips} imtina, ${stats.regretChecks} yoxlama`,
    },
  ];
}

export function shareSummary(stats: WeekStats, verdict: Verdict, score: number | null, awards: Award[]) {
  const earned = awards.filter((a) => a.earned).map((a) => a.title);
  const lines = [
    `Gələcək Məhkəməsinin hökmü: ${verdict.title}${score === null ? '' : ` (${score}/100)`}`,
    stats.scheduled > 0 ? `Missiyalar: ${stats.completed}/${stats.scheduled}` : null,
    `Fokus: ${stats.focusMinutes} dəq`,
    earned.length > 0 ? `Mükafatlar: ${earned.join(', ')}` : null,
    '— gələcəkdəki mən tərəfindən mühakimə olundum. Future Roast',
  ];
  return lines.filter(Boolean).join('\n');
}
