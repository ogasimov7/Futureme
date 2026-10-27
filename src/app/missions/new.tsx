import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { InlineNotice } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Form';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useData } from '@/data/store';
import type { Weekday } from '@/domain/types';
import { color, radius, space } from '@/theme/tokens';

// Monday-first for display; values stay 0 = Sunday to match the database.
const WEEK: { day: Weekday; label: string; name: string }[] = [
  { day: 1, label: 'Be', name: 'Bazar ertəsi' },
  { day: 2, label: 'Ça', name: 'Çərşənbə axşamı' },
  { day: 3, label: 'Ç', name: 'Çərşənbə' },
  { day: 4, label: 'Ca', name: 'Cümə axşamı' },
  { day: 5, label: 'C', name: 'Cümə' },
  { day: 6, label: 'Ş', name: 'Şənbə' },
  { day: 0, label: 'B', name: 'Bazar' },
];

const NO_GOAL = 'none';

export default function NewMissionScreen() {
  const params = useLocalSearchParams<{ goalId?: string }>();
  const { data, createMission } = useData();
  const goals = data.goals.filter((g) => !g.archivedAt);
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState<string>(params.goalId ?? NO_GOAL);
  const [days, setDays] = useState<Weekday[]>([0, 1, 2, 3, 4, 5, 6]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleDay = (d: Weekday) => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));

  const save = async () => {
    if (title.trim().length < 2) return setError('Missiyaya ad ver. Kiçik və konkret olsun.');
    if (days.length === 0) return setError('Ən azı bir gün seç.');
    setSaving(true);
    setError(null);
    try {
      await createMission({ title: title.trim(), goalId: goalId === NO_GOAL ? null : goalId, days });
      router.back();
    } catch {
      setError('Missiya yadda saxlanmadı. Yenidən cəhd et.');
      setSaving(false);
    }
  };

  return (
    <Screen insetTop={false}>
      <TextField
        label="Missiya"
        value={title}
        onChangeText={setTitle}
        placeholder="Yatmazdan əvvəl 10 səhifə"
        maxLength={80}
        hint="Ən pis günündə də edə biləcəyin qədər kiçik olsun."
        autoFocus
      />
      {goals.length > 0 && (
        <Section title="Hədəf">
          <ChipGroup
            options={[...goals.map((g) => ({ value: g.id, label: g.title })), { value: NO_GOAL, label: 'Hədəfsiz' }]}
            value={goalId}
            onChange={setGoalId}
          />
        </Section>
      )}
      <Section
        title="Günlər"
        aside={
          <Text variant="caption" color="textFaint">
            {days.length === 7 ? 'Hər gün' : `Həftədə ${days.length} gün`}
          </Text>
        }>
        <View style={styles.days}>
          {WEEK.map((w) => {
            const on = days.includes(w.day);
            return (
              <Pressable
                key={w.day}
                onPress={() => toggleDay(w.day)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={w.name}
                style={[styles.day, on && styles.dayOn]}>
                <Text variant="smallStrong" color={on ? 'onAccent' : 'textMuted'}>
                  {w.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
      {error && <InlineNotice tone="error" message={error} />}
      <Button label="Missiya əlavə et" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: space.xs },
  day: {
    flex: 1,
    maxWidth: 48,
    aspectRatio: 1,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  dayOn: { backgroundColor: color.accent, borderColor: color.accent },
});
