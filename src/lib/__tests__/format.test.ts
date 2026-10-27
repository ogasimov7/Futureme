import { formatDate, formatLocalDate, fromYear, ordinalSuffix, relativeTime } from '../format';

describe('ordinalSuffix (vowel harmony)', () => {
  it.each([
    [2027, 'ci'], // yeddi
    [2028, 'ci'], // səkkiz
    [2029, 'cu'], // doqquz
    [2030, 'cu'], // otuz
    [2031, 'ci'], // bir
    [2033, 'cü'], // üç
    [2034, 'cü'], // dörd
    [2036, 'cı'], // altı
    [2040, 'cı'], // qırx
    [2046, 'cı'], // altı
    [2050, 'ci'], // əlli
    [2100, 'cü'], // yüz
    [2000, 'ci'], // min
  ])('%i-%s', (n, suffix) => {
    expect(ordinalSuffix(n)).toBe(suffix);
  });

  it('builds "from year" phrases', () => {
    expect(fromYear(2031)).toBe('2031-ci ildən');
    expect(fromYear(2036)).toBe('2036-cı ildən');
  });
});

describe('Azerbaijani dates', () => {
  it('formats calendar days', () => {
    expect(formatLocalDate('2026-10-27')).toBe('27 okt');
    expect(formatLocalDate('2026-10-27', { weekday: 'long', month: 'long' })).toBe('Çərşənbə axşamı, 27 oktyabr');
    expect(formatLocalDate('2026-10-25', { weekday: 'long' })).toBe('Bazar, 25 okt');
  });

  it('formats instants in the given zone, with the year by default', () => {
    // 23:30 UTC on 27 Oct is already 28 Oct in Baku (UTC+4).
    expect(formatDate('2026-10-27T23:30:00Z', 'Asia/Baku')).toBe('28 okt 2026');
    expect(formatDate('2026-10-27T23:30:00Z', 'UTC')).toBe('27 okt 2026');
  });

  it('describes relative time', () => {
    const now = new Date('2026-10-27T12:00:00Z');
    expect(relativeTime(new Date('2026-10-30T12:00:00Z'), now)).toBe('3 gün sonra');
    expect(relativeTime(new Date('2026-04-27T12:00:00Z'), now)).toBe('6 ay əvvəl');
  });
});
