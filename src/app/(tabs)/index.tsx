import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { LetterCard } from '@/components/LetterCard';
import { MissionRow } from '@/components/MissionRow';
import { PersonaHeader } from '@/components/PersonaHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { PreviewBadge, Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { splitLetters, todaysMissions } from '@/data/selectors';
import { useData } from '@/data/store';
import { homeMessage } from '@/domain/futureSelf';
import { IMPULSE_EXAMPLES, IMPULSE_MAX_LENGTH } from '@/domain/regret';
import { formatLocalDate, fromYear, greeting, hourIn } from '@/lib/format';
import { color, font, radius, space } from '@/theme/tokens';

export default function HomeScreen() {
  const { data, today, mode, toggleMission } = useData();
  const [impulse, setImpulse] = useState('');
  const now = new Date();
  const prefs = data.preferences;
  const missions = todaysMissions(data, today);
  const done = missions.filter((m) => m.done).length;
  const bestStreak = Math.max(0, ...missions.map((m) => m.streak));
  const nextLetter = splitLetters(data, now).sealed[0];

  const ask = (text: string) => {
    if (!text.trim()) return;
    setImpulse('');
    router.push({ pathname: '/regret', params: { q: text.trim() } });
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="overline" color="textFaint">
          {formatLocalDate(today, { weekday: 'long', month: 'long' })}
        </Text>
        <Text variant="h1">
          {greeting(hourIn(data.profile.timeZone, now))}, {data.profile.displayName || 'dost'}.
        </Text>
        {mode === 'preview' && <PreviewBadge />}
      </View>

      <Animated.View entering={FadeInDown.duration(420)}>
        <Card tone="hero" style={styles.hero}>
          <PersonaHeader name={prefs.futureSelfName} year={prefs.futureYear} personality={prefs.personality} size={52} />
          <View style={styles.bubble}>
            <Text variant="quote">
              {homeMessage(prefs.personality, { done, due: missions.length, bestStreak, from: fromYear(prefs.futureYear) })}
            </Text>
          </View>
          <Button label="Cavab yaz" icon="chat" variant="secondary" size="sm" onPress={() => router.push('/chat')} style={styles.alignStart} />
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(420)}>
        <View style={styles.regret}>
          <View style={styles.regretTop}>
            <Text variant="h2">Peşman olacam?</Text>
            <Text variant="small" color="textMuted">
              Etmək istədiyin şeyi yaz. {prefs.futureSelfName} hökm versin.
            </Text>
          </View>
          <View style={styles.composer}>
            <TextInput
              value={impulse}
              onChangeText={setImpulse}
              placeholder="Məs: 200 AZN-ə ayaqqabı alım?"
              placeholderTextColor={color.textFaint}
              selectionColor={color.accent}
              maxLength={IMPULSE_MAX_LENGTH}
              returnKeyType="send"
              onSubmitEditing={() => ask(impulse)}
              accessibilityLabel="Nə etmək istəyirsən?"
              style={styles.input}
            />
            <Pressable
              onPress={() => ask(impulse)}
              disabled={!impulse.trim()}
              accessibilityRole="button"
              accessibilityLabel="Hökm al"
              accessibilityState={{ disabled: !impulse.trim() }}
              style={({ pressed }) => [styles.send, !impulse.trim() && styles.sendDisabled, pressed && styles.pressed]}>
              <Icon name="send" size={18} tint={color.onAccent} />
            </Pressable>
          </View>
          <View style={styles.examples}>
            {IMPULSE_EXAMPLES.slice(0, 3).map((e) => (
              <Chip key={e} label={e} onPress={() => ask(e)} />
            ))}
          </View>
        </View>
      </Animated.View>

      <Section
        title="Bugünkü missiyalar"
        aside={
          missions.length > 0 && (
            <Text variant="smallStrong" color="textMuted" accessibilityLabel={`${missions.length} missiyadan ${done} hazırdır`}>
              {done}/{missions.length}
            </Text>
          )
        }>
        {missions.length === 0 ? (
          <Card>
            <EmptyState
              icon="habits"
              title="Bu gün missiya yoxdur"
              body="Missiya pis gündə də edə biləcəyin kiçik, təkrarlanan addımdır. Birini əlavə et, gələcəkdəki sən hesabı aparsın."
              action={{ label: 'Missiya əlavə et', onPress: () => router.push('/missions/new') }}
            />
          </Card>
        ) : (
          <Card style={styles.tight}>
            {missions.map((m) => (
              <MissionRow
                key={m.mission.id}
                title={m.mission.title}
                done={m.done}
                streak={m.streak}
                onToggle={() => toggleMission(m.mission.id, today)}
              />
            ))}
          </Card>
        )}
      </Section>

      <Section title="Yolda olan məktub">
        {nextLetter ? (
          <LetterCard letter={nextLetter} sealed now={now} onPress={() => router.push(`/letters/${nextLetter.id}`)} />
        ) : (
          <Card>
            <EmptyState
              icon="letters"
              title="Yolda məktub yoxdur"
              body="İndi yaz, nə vaxt açılacağını seç. Gələcəkdəki sən çox səbirli məktub dostudur."
              action={{ label: 'Məktub yaz', onPress: () => router.push('/letters/new') }}
            />
          </Card>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  hero: { gap: space.lg },
  bubble: {
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.lg,
    borderTopLeftRadius: radius.sm,
    padding: space.lg,
  },
  alignStart: { alignSelf: 'flex-start' },
  regret: {
    gap: space.md,
    padding: space.lg + space.xs,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  regretTop: { gap: space.xs },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.xs + 2,
    paddingLeft: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.bg,
    borderWidth: 1,
    borderColor: color.accent,
  },
  input: { flex: 1, minHeight: 44, color: color.text, fontFamily: font.body, fontSize: 17 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
  pressed: { opacity: 0.75 },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tight: { paddingVertical: space.sm },
});
