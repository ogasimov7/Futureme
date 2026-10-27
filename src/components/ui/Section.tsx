import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { color, radius, space } from '@/theme/tokens';

import { Text } from './Text';

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text variant="overline" color="textMuted" accessibilityRole="header">
          {title}
        </Text>
        {aside}
      </View>
      {children}
    </View>
  );
}

/** Marks seeded demo data, so preview numbers are never mistaken for real activity. */
export function PreviewBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Demo məlumat göstərilir, real fəaliyyətin deyil">
      <View style={styles.dot} />
      <Text variant="caption" color="warning">
        Demo məlumat
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 24 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    alignSelf: 'flex-start',
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.warningSoft,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: color.warning },
});
