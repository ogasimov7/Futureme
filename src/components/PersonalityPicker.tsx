import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { PERSONALITY_INFO } from '@/domain/futureSelf';
import { PERSONALITIES, type Personality } from '@/domain/types';
import { color, radius, space } from '@/theme/tokens';

/** One card per personality with a sample line, so the choice is felt, not just named. */
export function PersonalityPicker({ value, onChange }: { value: Personality; onChange: (p: Personality) => void }) {
  return (
    <View style={styles.cards} accessibilityRole="radiogroup">
      {PERSONALITIES.map((p) => {
        const selected = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${PERSONALITY_INFO[p].label}. ${PERSONALITY_INFO[p].sample}`}
            style={[styles.card, selected && styles.cardSelected]}>
            <Text variant="h3" color={selected ? 'accent' : 'text'}>
              {PERSONALITY_INFO[p].label}
            </Text>
            <Text variant="quote" style={styles.sample}>
              “{PERSONALITY_INFO[p].sample}”
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  cards: { gap: space.md },
  card: {
    padding: space.lg,
    gap: space.sm,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1.5,
    borderColor: color.line,
  },
  cardSelected: { borderColor: color.accent, backgroundColor: color.hero },
  sample: { fontSize: 17, lineHeight: 24 },
});
