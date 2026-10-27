import { categorize } from '@/domain/regret';
import type { Personality } from '@/domain/types';

/**
 * Canned replies used until the `chat` Edge Function and Claude are connected.
 * The UI labels these as demo replies. Crisis language always gets a sincere response,
 * whatever personality is selected; the real server prompt has the same rule.
 */

const CRISIS_REPLY =
  'Bu dəfə zarafatı kənara qoyuram. Hiss etdiyin şey vacibdir və indi real bir insanın dəstəyinə layiqsən. ' +
  'Təhlükədəsənsə, 112-yə zəng et. Etibar etdiyin birinə yaz və ya findahelpline.com saytından yaxınlıqdakı dəstək xəttini tap. ' +
  'Danışmaq istəsən, mən hələ də buradayam.';

type Intent = 'roast' | 'track' | 'task' | 'default';

const REPLIES: Record<Personality, Record<Intent, string[]>> = {
  sarcastic: {
    roast: [
      'Həftənin icmalı: güclü başlanğıc, sirli orta hissə və hələ də montajda olan final. Tam festival filmi.',
      'Vərdiş qeydlərinə baxdım. Qəhrəmanın az qala qaçışa çıxdığı bir triller kimi oxunur.',
    ],
    track: ['Düz yoldasan? Bir yoldasan. Düzdür, ya yox, növbəti bir saatda nə edəcəyindən asılıdır.'],
    task: ['Kiçik tapşırıq: idman ayaqqabılarını qapının ağzına qoy. Ayaqqabı təzyiqindən istifadə etməyə utanmıram.'],
    default: [
      'Maraqlıdır. Davam et, sonra bir missiya da et ki, mən məşğul görünməyə ara verim.',
      'Qeyd etdim. "Sonra güləcəyimiz şeylər" qovluğuna atdım. Yəqin ki.',
    ],
  },
  supportive: {
    roast: ['Yumşaq roast: CEO kimi plan qurursan, pişik kimi dincəlirsən. İkisi də bacarıqdır. Gəl balanslaşdıraq.'],
    track: ['Düşündüyündən daha yaxınsan. Kiçik addımlar sandığından tez toplanır.'],
    task: ['İki dəqiqəlik tapşırıq: əsas hədəfinin sənin üçün niyə vacib olduğunu bir cümlə ilə yaz.'],
    default: ['Səni eşidirəm. Bu gün necə keçirsə keçsin, mənə gələn yolun bir hissəsidir.', 'Dediyin üçün sağ ol. Sabahı asanlaşdıracaq bir kiçik şey nədir?'],
  },
  strict: {
    roast: ['Roast: planların məşqlərindən çoxdur. Nisbəti düzəlt.'],
    track: ['Qismən. Missiyalarına bax. Fərqi bu gün bağla.'],
    task: ['Tapşırıq: növbəti missiya, indi, taymer işə. Sonra hesabat ver.'],
    default: ['Başa düşdüm. İndi hərəkət et.', 'Az danış, çox et. Mənə yenidən yazmazdan əvvəl bir missiya.'],
  },
  absurd: {
    roast: ['Gələcəkdə sənin bu həftən məktəblərdə "Ambisiyalı qəlyanaltı, II cild" adı ilə keçilir.'],
    track: ['Hesablamalarım (kalkulyatorlu göyərçin tərəfindən) deyir: əsasən hə, bir az qırıntı ilə.'],
    task: ['Kiçik tapşırıq: bir stəkan su iç və bu vaxt otaq bitkisinə göz-gözə bax.'],
    default: ['Gələcəyin tosterlər şurası mesajına baxdı və təsdiqlədi. Qızardılmış şəkildə.', 'Maraqlıdır. 2047-də yalnız əsnəməklə danışırıq, ona görə bu, təravətlidir.'],
  },
};

function intentOf(text: string): Intent {
  if (/roast|lağa/iu.test(text)) return 'roast';
  if (/(düz yoldayam|necəyəm|irəliləyiş|on track|progress)/iu.test(text)) return 'track';
  if (/(tapşırıq|nə edim|kiçik|növbəti|task)/iu.test(text)) return 'task';
  return 'default';
}

export function previewReply(personality: Personality, text: string, turn: number): string {
  if (categorize(text) === 'crisis') return CRISIS_REPLY;
  const options = REPLIES[personality][intentOf(text)];
  return options[turn % options.length];
}

export const CHAT_SUGGESTIONS = ['Həftəmi roast et', 'Düz yoldayam?', 'Mənə kiçik tapşırıq ver'] as const;
