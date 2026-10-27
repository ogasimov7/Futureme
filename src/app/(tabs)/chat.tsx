import { useFocusEffect } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';

import { PersonaHeader } from '@/components/PersonaHeader';
import { Chip } from '@/components/ui/Chip';
import { InlineNotice } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { CHAT_SUGGESTIONS } from '@/data/previewResponder';
import { useData } from '@/data/store';
import type { ChatMessage } from '@/domain/types';
import { color, font, maxContentWidth, radius, space } from '@/theme/tokens';

const MAX_LENGTH = 1000;

type Row = ChatMessage | { id: 'pending'; role: 'user'; content: string } | { id: 'typing' };

export default function ChatScreen() {
  const { data, sendChatMessage, aiAvailable, refreshAiStatus } = useData();
  // Re-check whenever the tab is opened, so a server restart is picked up without reloading.
  useFocusEffect(refreshAiStatus);
  const personality = data.preferences.personality;
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setFailed(false);
    setPending(trimmed);
    setDraft('');
    try {
      await sendChatMessage(trimmed, personality);
    } catch {
      setFailed(true);
      setDraft(trimmed);
    } finally {
      setPending(null);
    }
  };

  // Newest first, because the list is inverted so it sticks to the bottom.
  const rows: Row[] = [
    ...(pending ? [{ id: 'typing' } as const, { id: 'pending' as const, role: 'user' as const, content: pending }] : []),
    ...[...data.messages].reverse(),
  ];

  return (
    <Screen scroll={false} contentStyle={styles.screen}>
      <View style={styles.header}>
        <PersonaHeader name={data.preferences.futureSelfName} year={data.preferences.futureYear} personality={personality} size={44} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlatList
          inverted
          data={rows}
          keyExtractor={(r) => r.id}
          style={styles.flex}
          contentContainerStyle={styles.list}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => ('role' in item ? <Bubble message={item} /> : <TypingDots />)}
          ListFooterComponent={
            data.messages.length === 0 && !pending ? (
              <View style={styles.empty}>
                <Text variant="quote" align="center">
                  “Bunun necə bitdiyini görmüşəm. Nə istəsən soruş.”
                </Text>
                <View style={styles.suggestions}>
                  {CHAT_SUGGESTIONS.map((s) => (
                    <Chip key={s} label={s} onPress={() => send(s)} />
                  ))}
                </View>
              </View>
            ) : undefined
          }
        />

        {failed && (
          <View style={styles.notice}>
            <InlineNotice tone="error" message="Mesaj getmədi. Mətnin yenidən qutudadır." />
          </View>
        )}
        {data.messages.length > 0 && !pending && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll} contentContainerStyle={styles.quick}>
            {CHAT_SUGGESTIONS.map((s) => (
              <Chip key={s} label={s} onPress={() => send(s)} />
            ))}
          </ScrollView>
        )}
        <Composer
          value={draft}
          onChange={(t) => {
            setFailed(false);
            setDraft(t);
          }}
          onSend={() => send(draft)}
          busy={!!pending}
        />
        {aiAvailable !== null && (
          <Text variant="caption" color="textFaint" align="center" style={styles.disclaimer}>
            {aiAvailable
              ? 'Cavablar Gemini AI ilə yaradılır və səhv edə bilər.'
              : 'Oflayn cavablar: serverdə AI açarı tapılmadı.'}
          </Text>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ message }: { message: { role: 'user' | 'assistant'; content: string } }) {
  const mine = message.role === 'user';
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={[styles.bubbleRow, mine && styles.bubbleRowMine]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text variant="body" color={mine ? 'onAccent' : 'text'} selectable>
          {message.content}
        </Text>
      </View>
    </Animated.View>
  );
}

function TypingDots() {
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={[styles.bubble, styles.theirs, styles.typing]}
      accessibilityLabel="Gələcəkdəki sən yazır"
      accessibilityLiveRegion="polite">
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} />
      ))}
    </Animated.View>
  );
}

function Dot({ delay }: { delay: number }) {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withTiming(1, { duration: 480 }), -1, true));
  }, [delay, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, style]} />;
}

function Composer({ value, onChange, onSend, busy }: { value: string; onChange: (t: string) => void; onSend: () => void; busy: boolean }) {
  const canSend = value.trim().length > 0 && !busy;
  return (
    <View style={styles.composer}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="Gələcəkdəki sənə yaz…"
        placeholderTextColor={color.textFaint}
        selectionColor={color.accent}
        multiline
        maxLength={MAX_LENGTH}
        accessibilityLabel="Gələcəkdəki sənə yaz"
        style={styles.input}
        submitBehavior="newline"
      />
      <Pressable
        onPress={onSend}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Göndər"
        accessibilityState={{ disabled: !canSend, busy }}
        style={({ pressed }) => [styles.send, !canSend && styles.sendDisabled, pressed && styles.sendPressed]}>
        <Icon name="send" size={18} tint={color.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  flex: { flex: 1 },
  header: { paddingHorizontal: space.lg, paddingBottom: space.md },
  list: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm },
  bubbleRow: { flexDirection: 'row' },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '84%', paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.lg },
  mine: { backgroundColor: color.accent, borderBottomRightRadius: radius.sm },
  theirs: { backgroundColor: color.surfaceRaised, borderBottomLeftRadius: radius.sm },
  typing: { flexDirection: 'row', gap: 5, alignSelf: 'flex-start', paddingVertical: space.lg },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.textMuted },
  empty: { alignItems: 'center', gap: space.xl, paddingVertical: space.xxxl, paddingHorizontal: space.lg },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  quickScroll: { flexGrow: 0 },
  quick: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  notice: { paddingHorizontal: space.lg, paddingBottom: space.sm },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    marginHorizontal: space.lg,
    padding: space.xs + 2,
    paddingLeft: space.lg,
    borderRadius: radius.xl,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    paddingTop: 10,
    paddingBottom: 10,
    color: color.text,
    fontFamily: font.body,
    fontSize: 16,
  },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
  sendDisabled: { opacity: 0.35 },
  sendPressed: { backgroundColor: color.accentPressed },
  disclaimer: { paddingVertical: space.sm, paddingHorizontal: space.lg },
});
