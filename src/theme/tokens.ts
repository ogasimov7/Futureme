import type { TextStyle } from 'react-native';

/**
 * Future Roast design tokens. Dark-first: a clean neutral near-black base, crisp white
 * text, and vivid yellow reserved for the single most important action or highlight on
 * a screen. Every text color is at least 7:1 (WCAG AAA) against
 * every surface it appears on.
 */
export const color = {
  bg: '#0B0B0D',
  surface: '#161619',
  surfaceRaised: '#212125',
  hero: '#1C1C21',
  heroLine: 'rgba(255, 214, 10, 0.32)',
  line: '#2A2A2F',
  lineStrong: '#3F3F46',

  text: '#FAFAFA',
  textMuted: '#D4D4D8',
  textFaint: '#B0B0B8',

  accent: '#FFD60A',
  accentPressed: '#F0C400',
  accentSoft: 'rgba(255, 214, 10, 0.14)',
  /** Solid dark yellow for fills and borders that must not compete with `accent`. */
  accentDim: '#5C4D0C',
  onAccent: '#141414',

  success: '#5EE39C',
  successSoft: 'rgba(94, 227, 156, 0.14)',
  warning: '#FF9F45',
  warningSoft: 'rgba(255, 159, 69, 0.14)',
  danger: '#FF8F8F',
  dangerSoft: 'rgba(255, 143, 143, 0.13)',

  paper: '#FAF7F0',
  ink: '#18181B',
} as const;

export const space = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const font = {
  display: 'Fraunces_600SemiBold',
  displayItalic: 'Fraunces_400Regular_Italic',
  serif: 'Fraunces_400Regular',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

export const type = {
  display: { fontFamily: font.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8 },
  h1: { fontFamily: font.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  h2: { fontFamily: font.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  h3: { fontFamily: font.bodyBold, fontSize: 17, lineHeight: 22 },
  quote: { fontFamily: font.displayItalic, fontSize: 22, lineHeight: 30 },
  letter: { fontFamily: font.serif, fontSize: 18, lineHeight: 29 },
  body: { fontFamily: font.body, fontSize: 17, lineHeight: 24 },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 17, lineHeight: 24 },
  small: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  smallStrong: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 21 },
  // Medium weight: light text on dark backgrounds reads thinner than it is.
  caption: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 18 },
  overline: {
    fontFamily: font.bodyBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  numeral: { fontFamily: font.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.6 },
} satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
export type ColorToken = keyof typeof color;

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
} as const;

/** Content never stretches wider than this on tablets and web. */
export const maxContentWidth = 640;
