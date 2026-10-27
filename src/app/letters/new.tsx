import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { FutureSelfFace } from '@/components/FutureSelfFace';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { InlineNotice } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Form';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useData } from '@/data/store';
import {
  addMonths,
  DELIVERY_HOUR,
  DELIVERY_PRESETS,
  deliveryInstant,
  LETTER_LIMITS,
  validateLetterDraft,
  type LetterDraftErrors,
} from '@/domain/letters';
import { formatDate } from '@/lib/format';
import { color, space } from '@/theme/tokens';

export default function NewLetterScreen() {
  const { data, today, createLetter } = useData();
  const tz = data.profile.timeZone;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [preset, setPreset] = useState<string | null>(null);
  const [errors, setErrors] = useState<LetterDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sealedOn, setSealedOn] = useState<Date | null>(null);

  const months = DELIVERY_PRESETS.find((p) => p.id === preset)?.months;
  const deliverOn = months ? addMonths(today, months) : null;
  const opensAt = deliverOn ? deliveryInstant(deliverOn, tz) : null;

  const submit = async () => {
    const draft = { title, body, deliverOn };
    const found = validateLetterDraft(draft, new Date(), tz);
    setErrors(found);
    if (Object.keys(found).length > 0 || !deliverOn) return;
    setSaving(true);
    setSaveError(null);
    try {
      const letter = await createLetter({ title: title.trim(), body: body.trim(), deliverOn, timeZone: tz });
      setSealedOn(new Date(letter.deliverAt));
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Məktub möhürlənmədi. Mətnin yerindədir.');
    } finally {
      setSaving(false);
    }
  };

  if (sealedOn) {
    return (
      <Screen insetTop={false} contentStyle={styles.success}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.successInner}>
          <FutureSelfFace personality={data.preferences.personality} size={72} />
          <Text variant="h1" align="center">
            Möhürləndi.
          </Text>
          <Text variant="body" color="textMuted" align="center">
            {formatDate(sealedOn, tz, { weekday: 'long', month: 'long' })}, saat {String(DELIVERY_HOUR).padStart(2, '0')}:00-da açılacaq.
            O vaxta qədər bağlı qalır. Hətta sənin üçün də.
          </Text>
          <Button label="Hazırdır" onPress={() => router.back()} style={styles.full} />
        </Animated.View>
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={64}>
      <Screen insetTop={false}>
        <TextField
          label="Başlıq (istəyə bağlı)"
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setErrors((e) => ({ ...e, title: undefined }));
          }}
          placeholder="10 km-i qaçanda aç"
          maxLength={LETTER_LIMITS.titleMax}
          error={errors.title}
          returnKeyType="next"
        />
        <TextField
          label="Məktubun"
          value={body}
          onChangeText={(t) => {
            setBody(t);
            setErrors((e) => ({ ...e, body: undefined }));
          }}
          placeholder="Əziz gələcəkdəki mən…"
          multiline
          tall
          showCount
          maxLength={LETTER_LIMITS.bodyMax}
          error={errors.body}
        />
        <Section title="Nə vaxt açılsın?">
          <ChipGroup
            options={DELIVERY_PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            value={preset}
            onChange={(id) => {
              setPreset(id);
              setErrors((e) => ({ ...e, deliverOn: undefined }));
            }}
          />
          {errors.deliverOn ? (
            <Text variant="caption" color="danger" accessibilityRole="alert">
              {errors.deliverOn}
            </Text>
          ) : (
            opensAt && (
              <Text variant="small" color="textMuted">
                Açılır: {formatDate(opensAt, tz, { weekday: 'long' })}, saat {String(DELIVERY_HOUR).padStart(2, '0')}:00 ({tz})
              </Text>
            )
          )}
        </Section>
        <View style={styles.note}>
          <Text variant="caption" color="textFaint">
            Məktub həmin gün tətbiqdə açılacaq. Bildirişlər növbəti yenilənmədə gələcək. Möhürlənəndən sonra məktubu
            silə bilərsən, amma vaxtından əvvəl oxuya və ya dəyişə bilməzsən.
          </Text>
        </View>
        {saveError && <InlineNotice tone="error" message={saveError} />}
        <Button label="Möhürlə" icon="lock" onPress={submit} loading={saving} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: color.bg },
  note: { paddingHorizontal: space.xs },
  success: { flexGrow: 1, justifyContent: 'center' },
  successInner: { alignItems: 'center', gap: space.lg },
  full: { alignSelf: 'stretch', marginTop: space.lg },
});
