import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import type { Letter } from '@/domain/types';
import { formatDate, relativeTime } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';

export function LetterCard({ letter, sealed, now, onPress }: { letter: Letter; sealed: boolean; now: Date; onPress: () => void }) {
  const deliverAt = new Date(letter.deliverAt);
  const unread = !sealed && !letter.readAt;
  const title = letter.title || 'Başlıqsız məktub';
  const when = sealed
    ? `Açılır: ${formatDate(deliverAt, letter.deliveryTimeZone)} · ${relativeTime(deliverAt, now)}`
    : `${relativeTime(new Date(letter.createdAt), now)} yazılıb · ${formatDate(deliverAt, letter.deliveryTimeZone)} gəlib`;
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${when}${unread ? '. Oxunmayıb' : ''}`} style={styles.card}>
      <View style={[styles.seal, sealed ? styles.sealClosed : styles.sealOpen]}>
        <Icon name={sealed ? 'lock' : 'letters'} size={16} tint={sealed ? color.accent : color.ink} />
      </View>
      <View style={styles.text}>
        <View style={styles.titleRow}>
          <Text variant="h3" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          {unread && <View style={styles.unread} />}
        </View>
        <Text variant="caption" color="textFaint">
          {when}
        </Text>
      </View>
      <Icon name="chevronRight" size={14} tint={color.textFaint} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  seal: { width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sealClosed: { backgroundColor: color.accentSoft, borderWidth: 1, borderColor: color.accentDim },
  sealOpen: { backgroundColor: color.paper },
  text: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flexShrink: 1 },
  unread: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.accent },
});
