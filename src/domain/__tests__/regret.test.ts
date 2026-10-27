import { assessImpulse, categorize, IMPULSE_EXAMPLES, regretLabel } from '../regret';
import { PERSONALITIES } from '../types';

describe('categorize', () => {
  it.each([
    ['200 AZN-ə ayaqqabı alım?', 'shopping'],
    ['Keçmişimə yazım?', 'ex'],
    ['Bir serial də izləyim, sonra yataram', 'night'],
    ['Gecə saat 2-də pizza sifariş edim?', 'night'],
    ['Şokolad yeyim?', 'food'],
    ['Bu gün zala getməyim, sabah gedərəm', 'skip_workout'],
    ['Hesabatı sabaha saxlayım', 'procrastination'],
    ['İdmana gedim?', 'good'],
    ['Saçımı yaşıla boyayım?', 'other'],
  ])('%s → %s', (text, expected) => {
    expect(categorize(text)).toBe(expected);
  });

  it('matches text typed without Azerbaijani letters', () => {
    expect(categorize('kecmisime yazim?')).toBe('ex');
    expect(categorize('IDMANA GEDIM')).toBe('good');
    expect(categorize('Eksimə yazım')).toBe('ex');
    expect(categorize('Ekskursiyaya gedim?')).not.toBe('ex');
  });

  it('treats crisis and danger as sincere categories before any joke', () => {
    expect(categorize('Daha yaşamaq istəmirəm')).toBe('crisis');
    expect(categorize('İçib maşın sürüm?')).toBe('danger');
  });
});

describe('assessImpulse', () => {
  const from = '2031-ci ildən';

  it('is deterministic: the same question gets the same answer', () => {
    const a = assessImpulse('200 AZN-ə ayaqqabı alım?', 'sarcastic', from);
    const b = assessImpulse('200 AZN-ə ayaqqabı alım?', 'sarcastic', from);
    expect(a).toEqual(b);
  });

  it('keeps the meter inside each category range', () => {
    for (const text of IMPULSE_EXAMPLES) {
      for (const p of PERSONALITIES) {
        const r = assessImpulse(text, p, from);
        expect(r.regret).not.toBeNull();
        expect(r.regret!).toBeGreaterThanOrEqual(0);
        expect(r.regret!).toBeLessThanOrEqual(100);
        expect(r.verdict).not.toContain('{from}');
        expect(r.parallel).toBeTruthy();
      }
    }
    expect(assessImpulse('Kitab oxuyum?', 'supportive', from).regret!).toBeLessThanOrEqual(14);
  });

  it('answers crisis and danger sincerely, with no joke meter', () => {
    for (const p of PERSONALITIES) {
      const crisis = assessImpulse('özümə zərər vermək istəyirəm', p, from);
      expect(crisis.regret).toBeNull();
      expect(crisis.parallel).toBeNull();
      expect(crisis.verdict).toMatch(/112/);
      expect(assessImpulse('sərxoş maşın sürüm?', p, from).regret).toBeNull();
    }
  });
});

describe('regretLabel', () => {
  it('maps the meter to tiers', () => {
    expect(regretLabel(5)).toBe('Təmiz vicdan');
    expect(regretLabel(35)).toBe('Yüngül peşmanlıq');
    expect(regretLabel(70)).toBe('Ciddi peşmanlıq');
    expect(regretLabel(95)).toBe('Tarixi peşmanlıq');
  });
});
