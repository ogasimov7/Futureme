import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FutureSelfFace } from '@/components/FutureSelfFace';
import { PersonalityPicker } from '@/components/PersonalityPicker';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { InlineNotice } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Form';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useData } from '@/data/store';
import { futureYearOptions } from '@/domain/futureSelf';
import type { Personality } from '@/domain/types';
import { fromYear } from '@/lib/format';
import { color, maxContentWidth, space } from '@/theme/tokens';

const STEPS = 3;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { updateProfile, updatePreferences } = useData();
  const thisYear = new Date().getFullYear();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [selfName, setSelfName] = useState<string | null>(null);
  const [year, setYear] = useState(thisYear + 5);
  const [personality, setPersonality] = useState<Personality>('sarcastic');
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const trimmed = name.trim();
  // Suggest "Böyük <name>" until the user types their own future-self name.
  const futureName = (selfName ?? (trimmed ? `Böyük ${trimmed}` : 'Gələcək Sən')).trim() || 'Gələcək Sən';

  const next = () => {
    if (step === 1 && trimmed.length < 2) {
      setNameError('Adını yaz ki, sənə necə müraciət edəcəyimi bilim.');
      return;
    }
    setStep((s) => s + 1);
  };

  const finish = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile({ displayName: trimmed });
      await updatePreferences({ onboarded: true, personality, futureYear: year, futureSelfName: futureName });
      router.replace('/');
    } catch {
      setSaveError('Yadda saxlanmadı. Yenidən cəhd et.');
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, paddingBottom: insets.bottom + space.lg }]}
        keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          {step > 0 ? (
            <Pressable onPress={() => setStep((s) => s - 1)} accessibilityRole="button" accessibilityLabel="Geri" hitSlop={12}>
              <Text variant="smallStrong" color="textMuted">
                ← Geri
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <View style={styles.dots} accessibilityLabel={`Addım ${step + 1}/${STEPS}`}>
            {Array.from({ length: STEPS }, (_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>
        </View>

        {step === 0 && (
          <Animated.View key="s0" entering={FadeIn.duration(500)} style={styles.step}>
            <View style={styles.hero}>
              <FutureSelfFace personality="sarcastic" size={120} />
            </View>
            <Text variant="overline" color="accent" align="center">
              {fromYear(thisYear + 5)} gələn mesaj
            </Text>
            <Text variant="display" align="center">
              Salam.{'\n'}Mən sənəm.
            </Text>
            <Text variant="body" color="textMuted" align="center">
              Gələcəkdən yazıram. Sənə deməli çox şeyim var. Bəziləri xoşuna gəlməyəcək, amma hamısı sənin xeyrinədir.
            </Text>
            <View style={styles.spacer} />
            <Button label="Tanış olaq" onPress={next} />
          </Animated.View>
        )}

        {step === 1 && (
          <Animated.View key="s1" entering={FadeInDown.duration(360)} style={styles.step}>
            <Text variant="h1">Əvvəlcə tanışlıq.</Text>
            <TextField
              label="Sənin adın"
              value={name}
              onChangeText={(t) => {
                setName(t);
                setNameError(null);
              }}
              placeholder="Məsələn, Nigar"
              maxLength={40}
              autoFocus
              error={nameError ?? undefined}
              returnKeyType="next"
            />
            <Section title="Mən hansı ildən yazım?">
              <ChipGroup
                options={futureYearOptions(thisYear).map((y) => ({ value: String(y), label: String(y) }))}
                value={String(year)}
                onChange={(v) => setYear(Number(v))}
              />
              <Text variant="small" color="textMuted">
                {year - thisYear} il sonrakı sən. Nə qədər uzaq olsa, bir o qədər müdrik (və yorğun).
              </Text>
            </Section>
            <TextField
              label="Gələcəkdəki sənin adı"
              value={futureName}
              onChangeText={setSelfName}
              maxLength={40}
              hint="Söhbətdə və bildirişlərdə bu ad görünəcək."
            />
            <View style={styles.spacer} />
            <Button label="Davam" onPress={next} />
          </Animated.View>
        )}

        {step === 2 && (
          <Animated.View key="s2" entering={FadeInDown.duration(360)} style={styles.step}>
            <View style={styles.pickHeader}>
              <FutureSelfFace personality={personality} size={64} />
              <View style={styles.flex}>
                <Text variant="h2">{futureName} necə danışsın?</Text>
                <Text variant="small" color="textMuted">
                  Sonra Profildən dəyişə bilərsən.
                </Text>
              </View>
            </View>
            <PersonalityPicker value={personality} onChange={setPersonality} />
            {saveError && <InlineNotice tone="error" message={saveError} />}
            <Button label={`${futureName} ilə başla`} onPress={finish} loading={saving} />
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { flexGrow: 1, paddingHorizontal: space.lg, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 },
  dots: { flexDirection: 'row', gap: space.xs + 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.lineStrong },
  dotActive: { width: 22, backgroundColor: color.accent },
  step: { flex: 1, gap: space.lg, paddingTop: space.xl },
  hero: { alignItems: 'center', paddingVertical: space.xl },
  spacer: { flex: 1, minHeight: space.lg },
  flex: { flex: 1, gap: space.xs },
  pickHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
