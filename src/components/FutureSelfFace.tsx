import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { PERSONALITY_INFO } from '@/domain/futureSelf';
import type { Personality } from '@/domain/types';
import { color } from '@/theme/tokens';

/**
 * Future You, drawn with plain views: two eyes and a mouth whose shape follows the
 * selected personality. It breathes slowly. Reanimated skips the loop when the OS
 * reduce-motion setting is on.
 */
export function FutureSelfFace({ personality, size = 56 }: { personality: Personality; size?: number }) {
  const s = size / 64;
  const breath = useSharedValue(1);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1.035, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));

  const eye = (extra?: ViewStyle): ViewStyle => ({
    width: 7 * s,
    height: 9 * s,
    borderRadius: 4 * s,
    backgroundColor: color.onAccent,
    ...extra,
  });

  const face = {
    sarcastic: {
      left: eye(),
      right: eye({ height: 3 * s, marginTop: 4 * s }),
      mouth: {
        width: 18 * s,
        height: 8 * s,
        borderBottomWidth: 2.5 * s,
        borderColor: color.onAccent,
        borderBottomRightRadius: 12 * s,
        transform: [{ rotate: '-8deg' }, { translateX: 3 * s }],
      },
    },
    supportive: {
      left: eye(),
      right: eye(),
      mouth: {
        width: 22 * s,
        height: 11 * s,
        borderBottomWidth: 2.5 * s,
        borderColor: color.onAccent,
        borderBottomLeftRadius: 12 * s,
        borderBottomRightRadius: 12 * s,
      },
    },
    strict: {
      left: eye({ height: 6 * s, transform: [{ rotate: '18deg' }] }),
      right: eye({ height: 6 * s, transform: [{ rotate: '-18deg' }] }),
      mouth: { width: 18 * s, height: 2.5 * s, marginTop: 6 * s, backgroundColor: color.onAccent, borderRadius: 2 * s },
    },
    absurd: {
      left: eye({ width: 10 * s, height: 12 * s, borderRadius: 6 * s }),
      right: eye({ width: 5 * s, height: 5 * s, marginTop: 4 * s }),
      mouth: {
        width: 12 * s,
        height: 12 * s,
        borderRadius: 6 * s,
        borderWidth: 2.5 * s,
        borderColor: color.onAccent,
        marginTop: 2 * s,
      },
    },
  }[personality] satisfies { left: ViewStyle; right: ViewStyle; mouth: ViewStyle };

  return (
    <Animated.View
      accessibilityRole="image"
      accessibilityLabel={`Gələcəkdəki sən, ${PERSONALITY_INFO[personality].label.toLocaleLowerCase('az')} rejim`}
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2, padding: 3 * s }, animated]}>
      <View style={[styles.face, { borderRadius: size / 2, gap: 6 * s }]}>
        <View style={[styles.eyes, { gap: 12 * s }]}>
          <View style={face.left} />
          <View style={face.right} />
        </View>
        <View style={face.mouth} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  ring: { backgroundColor: color.accentDim, borderWidth: 1, borderColor: color.accentSoft },
  face: { flex: 1, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  eyes: { flexDirection: 'row', alignItems: 'flex-start', height: 12 },
});
