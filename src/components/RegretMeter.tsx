import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Text } from '@/components/ui/Text';
import { regretLabel } from '@/domain/regret';
import { color, radius, space } from '@/theme/tokens';

/** Joke meter: fills from 0 to `value` once, then stays. */
export function RegretMeter({ value }: { value: number }) {
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(value, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [fill, value]);
  const bar = useAnimatedStyle(() => ({ width: `${fill.value}%` }));
  const tone = value <= 20 ? color.success : value <= 50 ? color.accent : value <= 80 ? color.warning : color.danger;

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityLabel={`Peşmanlıq ölçəni: ${value} faiz, ${regretLabel(value)}. Zarafatdır.`}
      accessibilityValue={{ min: 0, max: 100, now: value }}>
      <View style={styles.top}>
        <Text variant="overline" color="textMuted">
          Peşmanlıq ölçəni
        </Text>
        <Text variant="smallStrong" style={{ color: tone }}>
          {regretLabel(value)}
        </Text>
      </View>
      <View style={styles.numberRow}>
        <Text variant="display" style={[styles.number, { color: tone }]}>
          {value}%
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { backgroundColor: tone }, bar]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  numberRow: { flexDirection: 'row', alignItems: 'baseline' },
  number: { fontSize: 56, lineHeight: 60 },
  track: { height: 12, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
