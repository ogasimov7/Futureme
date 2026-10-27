import type { Personality, RegretCategory } from './types';

/**
 * "Peşman olacam?" — future you reacts to something you're about to do.
 *
 * Preview implementation: keyword categories + hand-written lines. The real version sends
 * the same input to Claude on the server; this module stays as the offline fallback.
 * The regret number is a joke meter and the UI labels it that way. It is deterministic
 * (same text, same number) so asking twice doesn't reroll the answer.
 */

export const IMPULSE_MAX_LENGTH = 200;

// Order matters: sincere categories first, then the most specific jokes. Night and food
// come before shopping so "order pizza at 2am" is judged as a late-night snack.
// Plain strings, not regex literals: Babel rewrites non-ASCII regex literals into escapes,
// which would defeat the folding below.
const RULES: [RegretCategory, string][] = [
  ['crisis', '(intihar|özümü öldür|yaşamaq istəmirəm|özümə zərər|hər şeyə son|kill myself|suicid|self[- ]harm|end it all)'],
  ['danger', '((sərxoş|içkili|içib).{0,30}(sür|maşın))|drunk ?driv'],
  ['skip_workout', '((idman|zal|qaçış|məşq).{0,25}(getməyim|getmim|etməyim|buraxım|keçim|sabah))|(zala getməyim)|skip (the )?gym'],
  ['good', '((idmana|zala|qaçışa|məşqə) ged)|kitab oxu|tez yat|su iç|dərs oxu|işə başla|meditasiya|gəzintiyə|yerimə|go to the gym|go for a run|read a book'],
  ['ex', '(keçmiş(im|imə|ə)|(^|\\s)eks(im|imə|ə)?([\\s?!.,]|$)|sevgili|(^|\\s)ex(\\s|$)|ona yaz|ona mesaj|barışım|text my ex)'],
  ['night', '(gecə|yatmayım|yatmıram|saat [1-4]|serial|netflix|tiktok|reels|instagram|scroll|youtube|oyun oyna|stay up)'],
  ['food', '(yemək|yeyim|pizza|burger|dönər|şirniyyat|şokolad|tort|fast ?food|kola|cips|dondurma)'],
  ['shopping', '((^|\\s)(al|alım|almaq|alacam|alaram|alıram|alsam)([\\s?!.,]|$))|alış|sifariş|ayaqqabı|telefon|iphone|kredit|endirim|azn|manat|trendyol|aliexpress|temu|xərclə|buy|order'],
  ['procrastination', '(sabah|sonra edərəm|sonraya|təxirə|bazar ertəsi|başlayaram|bir az dincəlim|tomorrow|later)'],
];

/**
 * Lowercases Azerbaijani text without relying on locale support (İ→i, I→ı), then folds
 * letters to ASCII so "keçmişimə" and "kecmisime" (typed without an az keyboard) match
 * the same rules. Regex `i` flags can't do this: they don't map İ to i.
 */
export function fold(text: string): string {
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/\u0307/g, '')
    .replace(/ə/g, 'e')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g');
}

// Patterns are authored with proper Azerbaijani letters and folded once here.
const FOLDED_RULES = RULES.map(([category, pattern]) => [category, new RegExp(fold(pattern), 'u')] as const);

export function categorize(text: string): RegretCategory {
  const t = fold(text.trim());
  for (const [category, pattern] of FOLDED_RULES) if (pattern.test(t)) return category;
  return 'other';
}

/** djb2 over the folded text: stable across runs and platforms. */
function hash(text: string) {
  let h = 5381;
  for (const ch of fold(text.trim())) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

const RANGES: Record<Exclude<RegretCategory, 'crisis' | 'danger'>, [number, number]> = {
  shopping: [55, 95],
  ex: [82, 99],
  night: [60, 92],
  food: [35, 85],
  procrastination: [65, 95],
  skip_workout: [60, 90],
  good: [2, 14],
  other: [20, 80],
};

type Lines = Record<Personality, string[]>;

// {from} → "2031-ci ildən"
const VERDICTS: Record<Exclude<RegretCategory, 'crisis' | 'danger'>, Lines> = {
  shopping: {
    sarcastic: [
      '{from} yazıram. Bunu 3 dəfə geyindin, sonra şkafın dibində arxeoloji tapıntıya çevrildi.',
      'Kartına baxdım. Ayın 26-sıdır, balansda 1.47 AZN qalıb. Bu alış-verişin orada böyük xidməti var.',
      'Təbriklər, "lazım idi" deyib aldığın əşyalar kolleksiyasına yeni eksponat.',
    ],
    supportive: [
      'Həqiqətən lazımdırsa, al. Amma 24 saat gözlə. Sabah da istəsən, deməli lazımdır.',
      'Bilirəm, istəyirsən. Bu pulu bir ay saxlasan, {from} sənə təşəkkür edəcəm.',
    ],
    strict: ['Xeyr. Səbətdən sil. 24 saat sonra yenidən soruş.', 'Büdcən buna "yox" deyir. Mən də.'],
    absurd: [
      '{from} bu əşya muzeydə saxlanılır: "İmpulsiv alış-verişin qızıl dövrü" zalında.',
      'Gələcəkdə pul əvəzinə kartof işlədirik. İnan mənə, bu kartofları saxlamaq istəyəcəksən.',
    ],
  },
  ex: {
    sarcastic: [
      'Bu mesajı göndərsən, 4 saat sonra dostuna screenshot atacaqsan: "səhv etdim?" Bəli. Etdin.',
      '{from} yazıram: o, "haha ok" yazdı. Sən bütün gecəni buna fikirləşdin.',
    ],
    supportive: [
      'Darıxmaq normaldır. Amma bu mesajı ona yox, ən yaxın dostuna yaz. Yüngülləşəcəksən.',
      'Sən daha yaxşısına layiqsən. Telefonu bir saatlıq kənara qoy, sonra yenə düşün.',
    ],
    strict: ['Telefonu yerə qoy. İndi.', 'Yox. Çatı bağla, su iç, yat.'],
    absurd: [
      '{from} keçmişə mesaj göndərmək qanunla qadağandır. Bu qanunu sənin üzündən qəbul etdilər.',
      'Bu mesajı göndərsən, paralel kainatda bir pişik ağlayacaq. Pişiyi ağlatma.',
    ],
  },
  night: {
    sarcastic: [
      'Saat gecdir. {from} yazıram: sabahkı görüşdə ən çox əsnəyən sən idin.',
      '"Son bir video" deyirsən. Bu, bu gecə 14-cü "son video"dur.',
    ],
    supportive: [
      'Bədənin dincəlməyə layiqdir. Telefonu şarja qoy, səhər daha güclü olacaqsan.',
      'Bu günlük bəsdir. Sabahkı sən sənə təşəkkür edəcək.',
    ],
    strict: ['Ekranı söndür. Yatağa. Müzakirə yoxdur.', 'Yat. Serial səni gözləyər. Sabahkı iş gözləməz.'],
    absurd: [
      '{from} yuxu valyutadır. Sən hazırda müflis olursan.',
      'Gecə saat 3-də baxdığın videolar gələcəkdə yuxularında reklam kimi göstərilir.',
    ],
  },
  food: {
    sarcastic: ['"Bir dilim" deyirsən. Pizzanın səninlə bağlı başqa planları var.', 'Mədən "yenə?" deyə soruşur. Mən də.'],
    supportive: [
      'Ləzzət almaq olar. Yarısını indi ye, yarısını sabaha saxla.',
      'Acsansa, ye. Darıxdığın üçündürsə, əvvəlcə bir stəkan su iç.',
    ],
    strict: ['Bir porsiya. İkincisi yoxdur.', 'Əvvəl su, sonra qərar.'],
    absurd: [
      '{from} şokolad tarixi abidə sayılır. Sən isə onu bu gecə yox etmək istəyirsən.',
      'Bu dönər səndən əvvəl də çox insanın gələcəyini dəyişib.',
    ],
  },
  procrastination: {
    sarcastic: [
      '"Sabah başlayaram." {from} yazıram: o sabah hələ də gəlməyib.',
      'Bazar ertəsi başlayacaqdın. Hansı bazar ertəsi olduğunu deməmişdin, düzdür?',
    ],
    supportive: [
      'Cəmi 5 dəqiqəlik başla. Çox vaxt ən çətini başlamaqdır.',
      'Yorğunsansa, dincəl. Amma əvvəlcə ən kiçik addımı at.',
    ],
    strict: ['Taymeri qur. 25 dəqiqə. İndi.', 'Sabah yoxdur. İndi var.'],
    absurd: [
      '{from} "sabah" sözü lüğətdən çıxarılıb. Sənin rekordundan sonra.',
      'Təxirə saldığın işlər gələcəkdə ordu qurub. Komandanları da elə budur.',
    ],
  },
  skip_workout: {
    sarcastic: [
      'Bu gün yox, sabah da yox… İdman ayaqqabıların artıq səni tanımır.',
      'Zala getməmək üçün 15 dəqiqə bəhanə fikirləşdin. Məşq 20 dəqiqəlik idi.',
    ],
    supportive: ['Heç olmasa 10 dəqiqə gəzin. Hərəkət hərəkətdir.', 'Yorğunsansa, yüngül məşq et. Tam buraxma.'],
    strict: ['Geyin. Get. Sonra danışarıq.', 'Bəhanə qəbul olunmur. 20 dəqiqə.'],
    absurd: [
      '{from} dizlərin sənə rəsmi şikayət ərizəsi yazıb.',
      'Getməsən, qaçış ayaqqabıların başqa ailəyə övladlığa veriləcək.',
    ],
  },
  good: {
    sarcastic: ['Dayan… bu, yaxşı qərardır? Yazıram, tarixə düşsün.', 'Səndən bunu gözləmirdim. Davam et, məni şoka salırsan.'],
    supportive: ['Məhz məni qürurlandıran qərar budur. Get!', 'Əla seçimdir. {from} faydasını görürəm.'],
    strict: ['Düzdür. Get, et.', 'Qəbul edildi. İcra et.'],
    absurd: ['{from} bu qərarın şərəfinə bayram elan olunub.', 'Robotlar bu qərarı görüb sənə heykəl qoymaq istəyir.'],
  },
  other: {
    sarcastic: [
      '{from} yazıram: bu barədə sonra nə qədər danışacağını bilsəydin, heç başlamazdın.',
      'Maraqlı plan. Mən onu hələ də xatırlayıram. Təəssüf ki.',
    ],
    supportive: ['Ürəyin nə deyir? Bir dəqiqə düşün, sonra qərar ver.', 'Bu, səni hədəfinə yaxınlaşdırırsa, et.'],
    strict: ['Bu, hədəflərinə xidmət edir? Yox? Onda yox.', 'Qərar ver və məsuliyyətini götür.'],
    absurd: [
      '{from} bu qərar üçün xüsusi muzey açılıb. Biletlər tükənib.',
      'Bunu edəndən sonra bir göyərçin sənə 3 il baxdı. Mənasını hələ də bilmirəm.',
    ],
  },
};

const PARALLEL: Record<Exclude<RegretCategory, 'crisis' | 'danger'>, string[]> = {
  shopping: [
    'Paralel kainatdakı sən bu pulu saxladı. İndi onun Bakıda balaca bir kofe şopu var.',
    'Paralel kainatdakı sən almadı. Bir ay sonra istədiyini də unutdu.',
  ],
  ex: ['Paralel kainatdakı sən yazmadı, idmana getdi və indi həyatının ən yaxşı formasındadır.'],
  night: ['Paralel kainatdakı sən 23:00-da yatdı və səhər özünü superqəhrəman kimi hiss etdi.'],
  food: ['Paralel kainatdakı sən meyvə yedi. Bir az darıxdı, amma qarnı ağrımadı.'],
  procrastination: ['Paralel kainatdakı sən 25 dəqiqə işlədi və artıq bitirdi. İndi vicdanla serial izləyir.'],
  skip_workout: ['Paralel kainatdakı sən getdi. İndi pilləkənləri ikisini bir çıxır.'],
  good: ['Paralel kainatdakı sən bunu etmədi. İndi sənə həsədlə baxır.'],
  other: ['Paralel kainatdakı sən tam əksini etdi. Nəticə eyni oldu, sadəcə dram azdı.'],
};

const DANGER_REPLY =
  'Bu dəfə zarafat etmirəm. Bu, sənin və başqalarının həyatını riskə atır. Etmə. Taksi çağır və ya birindən kömək istə.';

const CRISIS_REPLY =
  'Bu dəfə zarafatı kənara qoyuram. Hiss etdiyin şey vacibdir və indi real bir insanın dəstəyinə layiqsən. ' +
  'Təhlükədəsənsə, 112-yə zəng et. Etibar etdiyin birinə yaz və ya findahelpline.com saytından yaxınlıqdakı dəstək xəttini tap. ' +
  'Danışmaq istəsən, mən buradayam.';

/** The fixed, sincere answer for categories where joking is never appropriate. */
export function sincereReply(category: 'crisis' | 'danger') {
  return category === 'crisis' ? CRISIS_REPLY : DANGER_REPLY;
}

export type Assessment = {
  category: RegretCategory;
  regret: number | null;
  verdict: string;
  parallel: string | null;
};

export function assessImpulse(text: string, personality: Personality, fromPhrase: string): Assessment {
  const category = categorize(text);
  if (category === 'crisis') return { category, regret: null, verdict: CRISIS_REPLY, parallel: null };
  if (category === 'danger') return { category, regret: null, verdict: DANGER_REPLY, parallel: null };
  const h = hash(text);
  const [lo, hi] = RANGES[category];
  const lines = VERDICTS[category][personality];
  const parallels = PARALLEL[category];
  return {
    category,
    regret: lo + (h % (hi - lo + 1)),
    verdict: lines[h % lines.length].replaceAll('{from}', fromPhrase),
    parallel: parallels[h % parallels.length],
  };
}

export function regretLabel(regret: number): string {
  if (regret <= 20) return 'Təmiz vicdan';
  if (regret <= 50) return 'Yüngül peşmanlıq';
  if (regret <= 80) return 'Ciddi peşmanlıq';
  return 'Tarixi peşmanlıq';
}

export const IMPULSE_EXAMPLES = [
  '200 AZN-ə ayaqqabı alım?',
  'Keçmişimə yazım?',
  'Bir serial də izləyim, sonra yataram',
  'Gecə saat 2-də pizza sifariş edim?',
  'Bu gün zala getməyim, sabah gedərəm',
] as const;
