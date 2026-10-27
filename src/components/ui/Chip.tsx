import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { color, radius, space } from '@/theme/tokens';

import { Text } from './Text';

type ChipProps = { label: string; selected?: boolean; onPress: () => void; accessibilityHint?: string };

export function Chip({ label, selected = false, onPress, accessibilityHint }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint={accessibilityHint}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}>
      <Text variant="smallStrong" color={selected ? 'onAccent' : 'textMuted'}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of chips where exactly one is selected. Scrolls horizontally when it overflows. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const chips = options.map((o) => (
    <Chip key={o.value} label={o.label} selected={o.value === value} onPress={() => onChange(o.value)} />
  ));
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips}
      </ScrollView>
    );
  }
  return (
    <View style={[styles.row, styles.wrap]} accessibilityRole="radiogroup">
      {chips}
    </View>
  );
}

/** Two or three equal segments, e.g. Sealed / Delivered. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && styles.segmentSelected]}>
            <Text variant="smallStrong" color={selected ? 'text' : 'textFaint'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  wrap: { flexWrap: 'wrap' },
  chip: {
    minHeight: 36,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.surfaceRaised,
    borderWidth: 1,
    borderColor: color.line,
  },
  selected: { backgroundColor: color.accent, borderColor: color.accent },
  pressed: { opacity: 0.75 },
  segmented: {
    flexDirection: 'row',
    backgroundColor: color.surface,
    borderRadius: radius.pill,
    padding: space.xs,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
  },
  segment: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  segmentSelected: { backgroundColor: color.surfaceRaised },
});
