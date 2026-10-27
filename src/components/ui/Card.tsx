import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius, space } from '@/theme/tokens';

type CardProps = {
  children: ReactNode;
  tone?: 'surface' | 'hero' | 'outline';
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, tone = 'surface', onPress, accessibilityLabel, style }: CardProps) {
  const toneStyle = styles[tone];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [styles.base, toneStyle, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.base, toneStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, padding: space.lg + space.xs, gap: space.md },
  surface: { backgroundColor: color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: color.line },
  hero: { backgroundColor: color.hero, borderWidth: 1, borderColor: color.heroLine },
  outline: { borderWidth: 1, borderColor: color.line, borderStyle: 'dashed' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
});
