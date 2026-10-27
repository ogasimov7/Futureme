import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { color, radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}>
      <View style={[styles.fill, { width: `${clamped * 100}%` }]} />
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%' }: { height?: number; width?: DimensionValue }) {
  const opacity = useSharedValue(0.45);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.9, { duration: 800 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, { height, width }, animated]} />;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={22} tint={color.accent} />
      </View>
      <Text variant="h3" align="center">
        {title}
      </Text>
      <Text variant="small" color="textMuted" align="center" style={styles.emptyBody}>
        {body}
      </Text>
      {action && <Button label={action.label} onPress={action.onPress} variant="secondary" size="sm" />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.empty} accessibilityRole="alert">
      <Text variant="h2" align="center">
        Gələcəkdəki sən kabelə ilişib yıxıldı.
      </Text>
      <Text variant="small" color="textMuted" align="center" style={styles.emptyBody}>
        {message}
      </Text>
      {onRetry && <Button label="Yenidən cəhd et" icon="refresh" onPress={onRetry} variant="secondary" size="sm" />}
    </View>
  );
}

/** Inline status line for forms and actions. */
export function InlineNotice({ tone, message }: { tone: 'error' | 'success' | 'info'; message: string }) {
  const map = {
    error: { bg: color.dangerSoft, fg: 'danger', icon: 'info' },
    success: { bg: color.successSoft, fg: 'success', icon: 'check' },
    info: { bg: color.accentSoft, fg: 'accent', icon: 'info' },
  } as const;
  const t = map[tone];
  return (
    <View
      style={[styles.notice, { backgroundColor: t.bg }]}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite">
      <Icon name={t.icon} size={16} tint={color[t.fg]} />
      <Text variant="small" color={t.fg} style={styles.noticeText}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill, backgroundColor: color.accent },
  skeleton: { backgroundColor: color.surfaceRaised, borderRadius: radius.sm },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.lg },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: color.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: { maxWidth: 300 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  noticeText: { flex: 1 },
});
