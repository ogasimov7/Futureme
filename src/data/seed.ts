import { addDays, localDateOf, zonedTimeToUtc } from '@/domain/dates';
import { addMonths, deliveryInstant } from '@/domain/letters';
import { assessImpulse } from '@/domain/regret';
import { isScheduledOn } from '@/domain/streaks';
import type { LocalDate, Mission, MissionCompletion, RegretCheck, Weekday } from '@/domain/types';
import { fromYear } from '@/lib/format';

import type { Snapshot } from './repository';

/** Deterministic PRNG so the preview data looks the same on every launch. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EVERY_DAY: Weekday[] = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS: Weekday[] = [1, 2, 3, 4, 5];

/** Seeded preview data anchored to `now`, so streaks and countdowns always look current. */
export function createSeed(now: Date, timeZone: string): { snapshot: Snapshot; letterBodies: Map<string, string> } {
  const today = localDateOf(now, timeZone);
  const at = (date: LocalDate, hour: number, minute = 0) => zonedTimeToUtc(date, hour, minute, timeZone).toISOString();
  const started = addDays(today, -27);
  const rand = mulberry32(20261027);

  const goals = [
    { id: 'g-run', title: 'Yaza qədər 10 km qaç', why: 'Pilləkənlər daha qalib gəlməsin deyə.', createdAt: at(started, 10), archivedAt: null },
    { id: 'g-ship', title: 'Yan layihəni bitir', why: 'Keçən ildən bəri "az qalıb" vəziyyətindədir.', createdAt: at(started, 10), archivedAt: null },
    { id: 'g-sleep', title: 'Böyük adam kimi yat', why: null, createdAt: at(addDays(started, 6), 21), archivedAt: null },
  ];

  const missions: Mission[] = [
    { id: 'm-run', goalId: 'g-run', title: '20 dəqiqə qaçış', days: [1, 3, 5, 6], createdAt: at(started, 10), archivedAt: null },
    { id: 'm-stretch', goalId: 'g-run', title: '5 dəqiqə dartınma', days: EVERY_DAY, createdAt: at(started, 10), archivedAt: null },
    { id: 'm-commit', goalId: 'g-ship', title: 'Yan layihəyə bir commit', days: WEEKDAYS, createdAt: at(started, 10), archivedAt: null },
    { id: 'm-phone', goalId: 'g-sleep', title: '23:00-da telefon yataq otağından çıxsın', days: EVERY_DAY, createdAt: at(addDays(started, 6), 21), archivedAt: null },
    { id: 'm-water', goalId: null, title: 'Qəhvədən əvvəl bir stəkan su', days: EVERY_DAY, createdAt: at(addDays(started, 2), 8), archivedAt: null },
  ];

  // How reliably the seeded "user" does each mission; tuned to produce varied streaks.
  const reliability: Record<string, number> = { 'm-run': 0.7, 'm-stretch': 0.85, 'm-commit': 0.55, 'm-phone': 0.6, 'm-water': 0.92 };
  const completions: MissionCompletion[] = [];
  for (const m of missions) {
    const created = localDateOf(new Date(m.createdAt), timeZone);
    for (let day = created; day < today; day = addDays(day, 1)) {
      if (isScheduledOn(m, day) && rand() < reliability[m.id]) {
        completions.push({ id: `c-${m.id}-${day}`, missionId: m.id, localDate: day, completedAt: at(day, 19, 30) });
      }
    }
  }
  // Today: two missions already done, so Home shows partial progress.
  for (const id of ['m-water', 'm-stretch']) {
    completions.push({ id: `c-${id}-${today}`, missionId: id, localDate: today, completedAt: now.toISOString() });
  }

  const focusSessions = [-6, -5, -3, -2, -1].map((offset, i) => {
    const day = addDays(today, offset);
    const minutes = [25, 50, 25, 15, 45][i];
    const startedAt = at(day, 14 + i);
    return {
      id: `f-${i}`,
      startedAt,
      endedAt: new Date(new Date(startedAt).getTime() + minutes * 60_000).toISOString(),
      plannedMinutes: minutes === 15 ? 25 : minutes,
      actualMinutes: minutes,
    };
  });

  const letterBodies = new Map<string, string>();
  const letter = (id: string, title: string, writtenOn: LocalDate, deliverOn: LocalDate, body: string, read: boolean) => {
    letterBodies.set(id, body);
    const deliverAt = deliveryInstant(deliverOn, timeZone).toISOString();
    return { id, title, createdAt: at(writtenOn, 22, 14), deliverAt, deliveryTimeZone: timeZone, readAt: read ? deliverAt : null };
  };
  const letters = [
    letter('l-spring', '10 km-dən əvvəl', addDays(today, -12), addDays(today, 23), 'Möhürlənmiş məktub (demo).', false),
    letter('l-year', 'Bu gecədən bir il sonra', addDays(today, -3), addMonths(today, 12), 'Möhürlənmiş məktub (demo).', false),
    letter(
      'l-summer',
      'Yay yoxlaması',
      addMonths(today, -6),
      addDays(today, -1),
      "Salam,\n\nGecdir və mən indicə qaçış ayaqqabıları haqqında on bir tab bağladım. Qaçmaq əvəzinə. Bunu oxuyursansa, ümid edirəm ki, birini seçib köhnələnə qədər geyinmisən.\n\nÜç şeyi xatırla: dincəldiyin üçün üzr istəməyi dayandıracağını demişdin. Yan layihənin mükəmməl olduğu üçün yox, sənin olduğu üçün vacib olduğunu demişdin. Və nənənə daha tez-tez zəng edəcəyini demişdin.\n\nEtdin? Düzünü de. Sonra etmədiyin birinin ən kiçik versiyasını et.\n\nSevgi ilə,\nKeçmişdəki sən (hazırda şam yeməyinə yarma yeyir)",
      false,
    ),
    letter(
      'l-new-year',
      'Hava soyuyanda aç',
      addMonths(today, -10),
      addMonths(today, -4),
      "Qış sən,\n\nGünlər qısalanda həmişə susursan. Bu, normaldır. Şam yandır, günorta bayıra çıx, bir dostuna yaz.\n\nİstirahəti qazanmalı deyilsən.\n\n— mən",
      true,
    ),
  ];

  const convoStart = new Date(now.getTime() - 26 * 3_600_000);
  const messages = [
    { role: 'user' as const, content: 'Yenə qaçışı buraxdım. Düzünü de.' },
    {
      role: 'assistant' as const,
      content: 'Düzünü? Qaçış ayaqqabıların emosional laqeydliyə görə şikayət yazıb. Amma bir buraxılmış qaçış vərdiş deyil, süjet dönüşüdür. Sabah 20 dəqiqə, və bir gün bu barədə danışmayacam.',
    },
    { role: 'user' as const, content: 'Razıyam. Səhər 7-də.' },
    { role: 'assistant' as const, content: 'Saat 7. Mən gələcəkdə özündən razı halda dartınacam.' },
  ].map((m, i) => ({
    id: `msg-seed-${i}`,
    ...m,
    personality: 'sarcastic' as const,
    createdAt: new Date(convoStart.getTime() + i * 90_000).toISOString(),
  }));

  const futureYear = now.getFullYear() + 5;
  const regretChecks: RegretCheck[] = [
    { text: '150 AZN-ə qulaqlıq alım?', daysAgo: 2, outcome: 'skipped' as const },
    { text: 'Gecə 2-də bir serial də izləyim?', daysAgo: 1, outcome: 'did_it' as const },
  ].map((c, i) => ({
    id: `r-seed-${i}`,
    text: c.text,
    ...assessImpulse(c.text, 'sarcastic', fromYear(futureYear)),
    personality: 'sarcastic' as const,
    createdAt: new Date(now.getTime() - c.daysAgo * 86_400_000).toISOString(),
    outcome: c.outcome,
  }));

  return {
    snapshot: {
      profile: { id: 'preview-user', displayName: '', timeZone, locale: 'az', createdAt: at(started, 9) },
      preferences: {
        onboarded: false,
        personality: 'sarcastic',
        futureSelfName: 'Gələcək Sən',
        futureYear,
        notifyMissionReminders: true,
        notifyLetterDeliveries: true,
        notifyWeeklyVerdict: true,
        aiMemoryEnabled: true,
        shareStatsWithAi: true,
      },
      goals,
      missions,
      completions,
      focusSessions,
      letters,
      messages,
      regretChecks,
    },
    letterBodies,
  };
}
