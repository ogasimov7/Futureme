import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { PersonaHeader } from '@/components/PersonaHeader';
import { RegretMeter } from '@/components/RegretMeter';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useData } from '@/data/store';
import { IMPULSE_EXAMPLES, IMPULSE_MAX_LENGTH, regretLabel } from '@/domain/regret';
import type { RegretCheck } from '@/domain/types';
import { relativeTime } from '@/lib/format';
import { shareViewAsImage } from '@/lib/shareCard';
import { color, font, radius, space } from '@/theme/tokens';

type State = { kind: 'idle' } | { kind: 'thinking'; text: string } | { kind: 'result'; check: RegretCheck } | { kind: 'error'; text: string };

export default function RegretScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { data, checkRegret, setRegretOutcome } = useData();
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [shareFailed, setShareFailed] = useState(false);
  const [outcomeFailed, setOutcomeFailed] = useState(false);
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const prefs = data.preferences;

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setShareFailed(false);
    setOutcomeFailed(false);
    setState({ kind: 'thinking', text: trimmed });
    try {
      setState({ kind: 'result', check: await checkRegret(trimmed) });
      setDraft('');
    } catch {
      setState({ kind: 'error', text: trimmed });
      setDraft(trimmed);
    }
  };

  // Arriving from Home with a question: ask it straight away, once.
  const askedFromParam = useRef(false);
  useEffect(() => {
    if (q && !askedFromParam.current) {
      askedFromParam.current = true;
      ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once for the incoming question
  }, [q]);

  // Read the live copy so the outcome buttons reflect what was saved.
  const current = state.kind === 'result' ? (data.regretChecks.find((c) => c.id === state.check.id) ?? state.check) : null;
  const sincere = current ? current.regret === null : false;
  const history = [...data.regretChecks].reverse().filter((c) => c.id !== current?.id).slice(0, 6);
  const now = new Date();

  const decide = async (outcome: 'skipped' | 'did_it') => {
    if (!current) return;
    setOutcomeFailed(false);
    try {
      await setRegretOutcome(current.id, outcome);
    } catch {
      setOutcomeFailed(true);
    }
  };

  const share = async () => {
    if (!current) return;
    setShareFailed(false);
    const text = `"${current.text}"\n${prefs.futureSelfName}: ${current.verdict}${current.regret === null ? '' : `\nPeşmanlıq: ${current.regret}%`}\n— Future Roast`;
    if (!(await shareViewAsImage(cardRef, text))) setShareFailed(true);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={64}>
      <Screen insetTop={false}>
        {state.kind !== 'result' && (
          <Composer
            value={draft}
            onChange={setDraft}
            onSubmit={() => ask(draft)}
            busy={state.kind === 'thinking'}
          />
        )}

        {state.kind === 'idle' && (
          <View style={styles.examples}>
            {IMPULSE_EXAMPLES.map((e) => (
              <Chip key={e} label={e} onPress={() => ask(e)} />
            ))}
          </View>
        )}

        {state.kind === 'thinking' && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.thinking} accessibilityLiveRegion="polite">
            <PersonaHeader
              name={prefs.futureSelfName}
              year={prefs.futureYear}
              personality={prefs.personality}
              subtitle="Gələcəyə baxır…"
            />
            <Text variant="quote" color="textMuted">
              “{state.text}”
            </Text>
            <Skeleton height={56} width="40%" />
            <Skeleton height={12} />
            <Skeleton height={18} width="90%" />
          </Animated.View>
        )}

        {state.kind === 'error' && (
          <InlineNotice tone="error" message="Gələcəklə əlaqə kəsildi. Sualın qutudadır, yenidən göndər." />
        )}

        {current && (
          <Animated.View entering={FadeInDown.duration(380)} style={styles.resultWrap}>
            {/* Captured as the share image, so it carries its own branding. */}
            <View ref={cardRef} collapsable={false} style={styles.card}>
              <PersonaHeader name={prefs.futureSelfName} year={prefs.futureYear} personality={current.personality} />
              <View style={styles.question}>
                <Text variant="overline" color="textFaint">
                  Sən soruşdun
                </Text>
                <Text variant="h2">“{current.text}”</Text>
              </View>
              {current.regret !== null && <RegretMeter value={current.regret} />}
              <Text variant="quote">{current.verdict}</Text>
              {current.parallel && (
                <View style={styles.parallel}>
                  <Text variant="overline" color="accent">
                    Paralel kainatda
                  </Text>
                  <Text variant="small" color="textMuted">
                    {current.parallel}
                  </Text>
                </View>
              )}
              <View style={styles.brand}>
                <Text variant="caption" color="textFaint">
                  Future Roast{current.source === 'ai' ? ' · Gemini AI' : current.source === 'offline' && !sincere ? ' · oflayn cavab' : ''}
                </Text>
                {!sincere && (
                  <Text variant="caption" color="textFaint">
                    Ölçən zarafatdır
                  </Text>
                )}
              </View>
            </View>

            {!sincere && (
              <>
                {current.outcome === null ? (
                  <View style={styles.row}>
                    <Button label="Etmirəm" icon="check" onPress={() => decide('skipped')} style={styles.flex} />
                    <Button label="Yenə də edəcəm" variant="secondary" onPress={() => decide('did_it')} style={styles.flex} />
                  </View>
                ) : (
                  <InlineNotice
                    tone={current.outcome === 'skipped' ? 'success' : 'info'}
                    message={
                      current.outcome === 'skipped'
                        ? 'Ağıllı seçim. Gələcək Məhkəməsində bu, "Ağıllı imtina" kimi sayılacaq.'
                        : 'Yaxşı. Mən bunu xatırlayacam. Həftə sonu məhkəmədə görüşərik.'
                    }
                  />
                )}
                {outcomeFailed && <InlineNotice tone="error" message="Seçimin yadda saxlanmadı. Yenidən toxun." />}
                <Button label="Story kimi paylaş" icon="share" variant="secondary" onPress={share} />
                {shareFailed && <InlineNotice tone="error" message="Bu cihazda paylaşmaq mümkün olmadı." />}
              </>
            )}
            <Button label="Başqa sual ver" variant="ghost" onPress={() => setState({ kind: 'idle' })} />
          </Animated.View>
        )}

        {history.length > 0 && state.kind !== 'thinking' && (
          <Section title="Əvvəlki hökmlər">
            <View style={styles.history}>
              {history.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setState({ kind: 'result', check: c })}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.text}. ${c.regret === null ? '' : `${c.regret} faiz peşmanlıq.`}`}
                  style={({ pressed }) => [styles.historyRow, pressed && styles.pressed]}>
                  <View style={styles.flex}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {c.text}
                    </Text>
                    <Text variant="caption" color="textFaint">
                      {relativeTime(new Date(c.createdAt), now)}
                      {c.outcome === 'skipped' ? ' · imtina etdin' : c.outcome === 'did_it' ? ' · yenə də etdin' : ''}
                    </Text>
                  </View>
                  {c.regret !== null && (
                    <View style={styles.pill} accessibilityLabel={regretLabel(c.regret)}>
                      <Text variant="smallStrong" color="accent">
                        {c.regret}%
                      </Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        <Text variant="caption" color="textFaint">
          Peşmanlıq ölçəni zarafatdır, elmi hesablama deyil. Gələcəkdəki sən də hər şeyi bilmir.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Composer({ value, onChange, onSubmit, busy }: { value: string; onChange: (t: string) => void; onSubmit: () => void; busy: boolean }) {
  const canSend = value.trim().length > 0 && !busy;
  return (
    <View style={styles.composer}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Nə etmək istəyirsən?"
        placeholderTextColor={color.textFaint}
        selectionColor={color.accent}
        maxLength={IMPULSE_MAX_LENGTH}
        multiline
        submitBehavior="blurAndSubmit"
        returnKeyType="send"
        onSubmitEditing={onSubmit}
        accessibilityLabel="Nə etmək istəyirsən?"
        style={styles.input}
      />
      <Pressable
        onPress={onSubmit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Gələcəkdəki sənə soruş"
        accessibilityState={{ disabled: !canSend, busy }}
        style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && styles.pressed]}>
        <Icon name="send" size={18} tint={color.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  flex: { flex: 1 },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  thinking: { gap: space.lg },
  resultWrap: { gap: space.md },
  card: {
    gap: space.lg,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: color.hero,
    borderWidth: 1,
    borderColor: color.heroLine,
  },
  question: { gap: space.xs },
  parallel: {
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  brand: { flexDirection: 'row', justifyContent: 'space-between' },
  row: { flexDirection: 'row', gap: space.md },
  history: { gap: space.sm },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  pill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.pill, backgroundColor: color.accentSoft },
  pressed: { opacity: 0.75 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    padding: space.xs + 2,
    paddingLeft: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.accent,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingTop: 11,
    paddingBottom: 11,
    color: color.text,
    fontFamily: font.body,
    fontSize: 17,
  },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
});
