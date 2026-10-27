import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { color, radius, space } from '@/theme/tokens';

type MissionRowProps = {
  title: string;
  done: boolean;
  streak: number;
  subtitle?: string;
  /** Rest days: shown for context but not tickable, since they wouldn't count anywhere. */
  disabled?: boolean;
  onToggle: () => Promise<void>;
};

export function MissionRow({ title, done, streak, subtitle, disabled = false, onToggle }: MissionRowProps) {
  const [failed, setFailed] = useState(false);
  const toggle = async () => {
    setFailed(false);
    try {
      await onToggle();
    } catch {
      setFailed(true);
    }
  };
  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: done, disabled }}
      accessibilityLabel={title}
      accessibilityHint={done ? 'Missiyanı edilməmiş kimi işarələyir' : 'Missiyanı edilmiş kimi işarələyir'}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, disabled && styles.disabled]}>
      <View style={[styles.box, done && styles.boxDone, disabled && styles.boxDisabled]}>
        {done && (
          <Animated.View entering={ZoomIn.duration(180)}>
            <Icon name="check" size={14} tint={color.onAccent} />
          </Animated.View>
        )}
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" color={done ? 'textFaint' : 'text'} style={done && styles.struck}>
          {title}
        </Text>
        {failed ? (
          <Text variant="caption" color="danger">
            Yadda saxlanmadı. Yenidən toxun.
          </Text>
        ) : (
          subtitle && (
            <Text variant="caption" color="textFaint">
              {subtitle}
            </Text>
          )
        )}
      </View>
      {streak > 0 && (
        <View style={styles.streak} accessibilityLabel={`${streak} günlük seriya`}>
          <Icon name="flame" size={13} tint={color.warning} />
          <Text variant="smallStrong" color="warning">
            {streak}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 56, paddingVertical: space.sm },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.6 },
  boxDisabled: { borderStyle: 'dashed' },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: color.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxDone: { backgroundColor: color.accent, borderColor: color.accent },
  text: { flex: 1, gap: 2 },
  struck: { textDecorationLine: 'line-through' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
