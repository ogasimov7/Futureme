import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { PersonaHeader } from '@/components/PersonaHeader';
import { PersonalityPicker } from '@/components/PersonalityPicker';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { InlineNotice } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Form';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useData } from '@/data/store';
import { futureYearOptions, PERSONALITY_INFO } from '@/domain/futureSelf';
import type { Personality } from '@/domain/types';
import { color, radius, space } from '@/theme/tokens';

/**
 * The only place to change what was chosen in onboarding. Edits are a draft until saved,
 * so the persona never changes by accident while chatting.
 */
export default function PersonaSettingsScreen() {
  const { data, updateProfile, updatePreferences } = useData();
  const prefs = data.preferences;
  const thisYear = new Date().getFullYear();
  const [name, setName] = useState(data.profile.displayName);
  const [selfName, setSelfName] = useState(prefs.futureSelfName);
  const [year, setYear] = useState(prefs.futureYear);
  const [personality, setPersonality] = useState<Personality>(prefs.personality);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const changed =
    name.trim() !== data.profile.displayName ||
    selfName.trim() !== prefs.futureSelfName ||
    year !== prefs.futureYear ||
    personality !== prefs.personality;

  const save = async () => {
    if (name.trim().length < 2 || selfName.trim().length < 2) {
      setError('Adlar ən azı 2 hərf olmalıdır.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (name.trim() !== data.profile.displayName) await updateProfile({ displayName: name.trim() });
      await updatePreferences({ futureSelfName: selfName.trim(), futureYear: year, personality });
      router.back();
    } catch {
      setError('Yadda saxlanmadı. Yenidən cəhd et.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={64}>
      <Screen insetTop={false}>
        <View style={styles.preview} accessibilityLabel="Önizləmə">
          <PersonaHeader name={selfName.trim() || 'Gələcək Sən'} year={year} personality={personality} size={52} />
          <Text variant="quote">“{PERSONALITY_INFO[personality].sample}”</Text>
        </View>

        <Section title="Xarakter">
          <PersonalityPicker value={personality} onChange={setPersonality} />
        </Section>

        <Section title="Hansı ildən yazır?">
          <ChipGroup
            options={futureYearOptions(thisYear, prefs.futureYear).map((y) => ({ value: String(y), label: String(y) }))}
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
          />
        </Section>

        <Section title="Adlar">
          <TextField label="Sənin adın" value={name} onChangeText={setName} maxLength={40} />
          <TextField label="Gələcəkdəki sənin adı" value={selfName} onChangeText={setSelfName} maxLength={40} />
        </Section>

        {error && <InlineNotice tone="error" message={error} />}
        <Button label="Yadda saxla" onPress={save} loading={saving} disabled={!changed} />
        <Text variant="caption" color="textFaint" align="center">
          Dəyişiklik yalnız yeni cavablara təsir edir. Köhnə hökmlər və mesajlar olduğu kimi qalır.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  preview: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.hero,
    borderWidth: 1,
    borderColor: color.heroLine,
  },
});
