import { StyleSheet, View } from 'react-native';

import { FutureSelfFace } from '@/components/FutureSelfFace';
import { Text } from '@/components/ui/Text';
import type { Personality } from '@/domain/types';
import { fromYear } from '@/lib/format';
import { color, space } from '@/theme/tokens';

/** "Böyük Nigar · 2031-ci ildən · Online" — who is talking, and from when. */
export function PersonaHeader({
  name,
  year,
  personality,
  size = 48,
  subtitle,
}: {
  name: string;
  year: number;
  personality: Personality;
  size?: number;
  subtitle?: string;
}) {
  return (
    <View style={styles.row}>
      <FutureSelfFace personality={personality} size={size} />
      <View style={styles.text}>
        <Text variant="h3" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.status} accessibilityLabel={`${fromYear(year)} yazır, onlayn`}>
          <View style={styles.dot} />
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle ?? `${fromYear(year)} · Online`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.success },
});
