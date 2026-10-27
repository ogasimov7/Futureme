import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LetterCard } from '@/components/LetterCard';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Feedback';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { splitLetters } from '@/data/selectors';
import { useData } from '@/data/store';
import { space } from '@/theme/tokens';

type Tab = 'sealed' | 'delivered';

export default function LettersScreen() {
  const { data } = useData();
  const now = new Date();
  const { sealed, delivered } = splitLetters(data, now);
  const unread = delivered.filter((l) => !l.readAt).length;
  const [tab, setTab] = useState<Tab>(unread > 0 ? 'delivered' : 'sealed');
  const list = tab === 'sealed' ? sealed : delivered;

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="h1">Məktublar</Text>
          <Text variant="small" color="textMuted">
            İndi yaz. Sonra aç. Gizlicə baxmaq olmaz, hətta sənə də.
          </Text>
        </View>
        <Button label="Yaz" icon="plus" size="sm" onPress={() => router.push('/letters/new')} />
      </View>

      <Segmented
        options={[
          { value: 'sealed', label: `Möhürlü · ${sealed.length}` },
          { value: 'delivered', label: unread > 0 ? `Gələnlər · ${unread} yeni` : `Gələnlər · ${delivered.length}` },
        ]}
        value={tab}
        onChange={setTab}
      />

      {list.length === 0 ? (
        tab === 'sealed' ? (
          <EmptyState
            icon="lock"
            title="Poçt qutusu boşdur"
            body="Məktubu möhürlə və nə vaxt açılacağını seç: gələn ay, gələn il, ya da tamam başqa insan olanda."
            action={{ label: 'İlk məktubunu yaz', onPress: () => router.push('/letters/new') }}
          />
        ) : (
          <EmptyState
            icon="letters"
            title="Hələ məktub gəlməyib"
            body="Məktublar açıldıqları səhər burada görünür. Səbir də hədiyyənin bir hissəsidir."
          />
        )
      ) : (
        <View style={styles.list}>
          {list.map((letter, i) => (
            <Animated.View key={letter.id} entering={FadeInDown.delay(i * 40).duration(260)}>
              <LetterCard
                letter={letter}
                sealed={tab === 'sealed'}
                now={now}
                onPress={() => router.push(`/letters/${letter.id}`)}
              />
            </Animated.View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headerText: { flex: 1, gap: space.xs },
  list: { gap: space.md },
});
