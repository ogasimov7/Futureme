import { Text as RNText, type TextProps } from 'react-native';

import { color as palette, type ColorToken, type TypeVariant, type as typeScale } from '@/theme/tokens';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', color = 'text', align, style, ...rest }: AppTextProps) {
  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.6}
      style={[typeScale[variant], { color: palette[color] }, align && { textAlign: align }, style]}
    />
  );
}
