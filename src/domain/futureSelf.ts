import type { Personality } from './types';

export const PERSONALITY_INFO: Record<Personality, { label: string; blurb: string; sample: string }> = {
  sarcastic: {
    label: 'Sarkastik',
    blurb: 'Quru yumor, qaldırılmış qaş. Gizlicə sənin tərəfindədir.',
    sample: 'Yenə sabaha saxladın? Sabahın da sabahı var, bilirsən.',
  },
  supportive: {
    label: 'Dəstəkləyici',
    blurb: 'İsti, ruhlandırıcı, amma həqiqəti deyir.',
    sample: 'Kiçik addım da addımdır. Mən səninlə fəxr edirəm.',
  },
  strict: {
    label: 'Sərt',
    blurb: 'Çavuş enerjisi. Qısa cümlələr. Bəhanə yoxdur.',
    sample: 'Bəhanəni eşitdim. İndi taymeri qur.',
  },
  absurd: {
    label: 'Absurd',
    blurb: 'Tosterlərin danışdığı gələcəkdən reportajlar.',
    sample: 'Gələcəkdə göyərçinlər vergi ödəyir. Sən isə hələ də yatmamısan.',
  },
};

/** Year choices offered for future you: 1, 5, 10 and 20 years ahead (plus the saved one). */
export function futureYearOptions(thisYear: number, current?: number): number[] {
  const years = new Set([1, 5, 10, 20].map((n) => thisYear + n));
  if (current) years.add(current);
  return [...years].sort((a, b) => a - b);
}

type DayContext = { done: number; due: number; bestStreak: number; from: string };

/**
 * The Home greeting from future you. Uses only the counts it is given, so the joke
 * never claims activity that wasn't recorded.
 */
export function homeMessage(personality: Personality, ctx: DayContext): string {
  const { done, due, bestStreak, from } = ctx;
  const left = due - done;
  if (due === 0) {
    return {
      sarcastic: `${from} yazıram. Bu gün missiyan yoxdur. Cəsarətli strategiya: heç nə etmə, heç nəyə peşman olma.`,
      supportive: 'Bu gün plan yoxdur. İstirahət də vacibdir. Bəlkə mənə bir məktub yazasan?',
      strict: 'Lövhədə sıfır missiya. Birini əlavə et. Boş əllər, yumşaq gələcək.',
      absurd: `${from} belə günlərə "toster günü" deyirik. Çox müqəddəsdir.`,
    }[personality];
  }
  if (left === 0) {
    return {
      sarcastic: `${due} missiyanın hamısı bitib. İki dəfə yoxladım. Sən kimsən və həqiqi səni hara gizlətmisən?`,
      supportive: 'Bu günün bütün missiyaları tamamdır. Bu günü xatırlayıram. Düşündüyündən də vacib idi.',
      strict: `${due}/${due}. Qəbul edilir. Sabah təkrarla.`,
      absurd: `Bütün missiyalar bitdi. ${from} sənin şərəfinə parad planlaşdırılıb.`,
    }[personality];
  }
  if (done === 0) {
    return {
      sarcastic: `${from} yazıram. Sənin üçün ${due} missiya var, hələ heç biri edilməyib. Yəqin, hələ yüklənir.`,
      supportive: `Bu gün ${due} kiçik missiya var. Ən asanından başla. Mən buradayam.`,
      strict: `${due} missiya. Sıfır icra. Birini seç. Başla.`,
      absurd: `0/${due} missiya. Uçan kaykayım qızışıb. Bir missiya et ki, havaya qalxa bilsin.`,
    }[personality];
  }
  const streakNote = bestStreak >= 3 ? ` O ${bestStreak} günlük seriya səni izləyir.` : '';
  return {
    sarcastic: `${done}/${due} missiya hazırdır. Bununla öyünməyə yarı yoldasan.${streakNote}`,
    supportive: `${done}/${due} missiya bitib. Bu, real irəliləyişdir. Cəmi ${left} qaldı.${streakNote}`,
    strict: `${done}/${due}. ${left} qaldı. Bitir.${streakNote}`,
    absurd: `${done}/${due} missiya bitib. Gələcəyin robotları qeyd götürür.${streakNote}`,
  }[personality];
}
