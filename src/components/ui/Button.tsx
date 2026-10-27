import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { color, radius, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const fg: Record<Variant, keyof typeof color> = {
  primary: 'onAccent',
  secondary: 'text',
  ghost: 'accent',
  danger: 'danger',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const inactive = disabled || loading;
  const tint = color[fg[variant]];
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === 'sm' ? 8 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        styles[variant],
        pressed && variant === 'primary' && { backgroundColor: color.accentPressed },
        pressed && variant !== 'primary' && styles.pressedSoft,
        disabled && styles.disabled,
        style,
      ]}>
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          icon && <Icon name={icon} size={size === 'sm' ? 15 : 17} tint={tint} />
        )}
        <Text variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} color={fg[variant]}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 50, paddingHorizontal: space.xl },
  sm: { minHeight: 36, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  primary: { backgroundColor: color.accent },
  secondary: { backgroundColor: color.surfaceRaised, borderWidth: 1, borderColor: color.lineStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: color.dangerSoft },
  pressedSoft: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
});
