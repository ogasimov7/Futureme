import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, InlineNotice, Skeleton } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { Text } from '@/components/ui/Text';
import { useData } from '@/data/store';
import { DELIVERY_HOUR, isDelivered } from '@/domain/letters';
import { formatDate, relativeTime } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';

type BodyState = { status: 'loading' } | { status: 'ready'; body: string } | { status: 'error'; message: string };

export default function LetterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, readLetterBody, markLetterRead, deleteLetter } = useData();
  const letter = data.letters.find((l) => l.id === id);
  const now = new Date();
  const delivered = letter ? isDelivered(letter, now) : false;
  const [body, setBody] = useState<BodyState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!letter || !delivered) return;
    let cancelled = false;
    readLetterBody(letter.id)
      .then((text) => {
        if (cancelled) return;
        if (text === null) setBody({ status: 'error', message: 'Bu məktub hələ açıq deyil.' });
        else {
          setBody({ status: 'ready', body: text });
          // Best effort: if this fails the letter just keeps its unread dot.
          if (!letter.readAt) markLetterRead(letter.id).catch(() => {});
        }
      })
      .catch(() => !cancelled && setBody({ status: 'error', message: 'Məktub açılmadı. İnterneti yoxla.' }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the letter or retry changes
  }, [letter?.id, delivered, attempt]);

  if (!letter) {
    return (
      <Screen insetTop={false}>
        <EmptyState icon="letters" title="Məktub tapılmadı" body="Bəlkə də silinib." action={{ label: 'Məktublara qayıt', onPress: () => router.back() }} />
      </Screen>
    );
  }

  const tz = letter.deliveryTimeZone;
  const deliverAt = new Date(letter.deliverAt);

  const remove = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLetter(letter.id);
      router.back();
    } catch {
      setDeleteError('Məktub silinmədi. Yenidən cəhd et.');
      setDeleting(false);
    }
  };

  if (!delivered) {
    return (
      <Screen insetTop={false} contentStyle={styles.sealedContent}>
        <Stack.Screen options={{ title: 'Möhürlü' }} />
        <Animated.View entering={FadeIn.duration(360)} style={styles.sealedInner}>
          <View style={styles.wax}>
            <Icon name="lock" size={30} tint={color.onAccent} />
          </View>
          <Text variant="h1" align="center">
            {letter.title || 'Başlıqsız məktub'}
          </Text>
          <Text variant="body" color="textMuted" align="center">
            {formatDate(deliverAt, tz, { weekday: 'long', month: 'long' })}, saat {String(DELIVERY_HOUR).padStart(2, '0')}:00-da
            açılacaq ({relativeTime(deliverAt, now)}).
          </Text>
          <Text variant="small" color="textFaint" align="center">
            {formatDate(letter.createdAt, tz)} tarixində yazılıb. O vaxta qədər məzmunu serverdə kilidli qalır.
          </Text>
        </Animated.View>
        <View style={styles.actions}>
          {deleteError && <InlineNotice tone="error" message={deleteError} />}
          <Button
            label={confirmDelete ? 'Həmişəlik silmək üçün yenidən toxun' : 'Məktubu sil'}
            icon="trash"
            variant="danger"
            size="sm"
            loading={deleting}
            onPress={remove}
            accessibilityHint="Möhürlü məktubu silmək geri qaytarıla bilməz"
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen insetTop={false}>
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.meta}>
        <Text variant="overline" color="accent">
          Keçmişdəki səndən · {formatDate(letter.createdAt, tz)}
        </Text>
        <Text variant="h1">{letter.title || 'Başlıqsız məktub'}</Text>
      </View>
      {body.status === 'loading' && (
        <View style={styles.paper}>
          <Skeleton height={18} />
          <Skeleton height={18} width="85%" />
          <Skeleton height={18} width="92%" />
        </View>
      )}
      {body.status === 'error' && <ErrorState message={body.message} onRetry={() => {
            setBody({ status: 'loading' });
            setAttempt((n) => n + 1);
          }} />}
      {body.status === 'ready' && (
        <Animated.View entering={FadeIn.duration(500)} style={styles.paper}>
          <Text variant="letter" style={styles.ink} selectable>
            {body.body}
          </Text>
        </Animated.View>
      )}
      <Text variant="caption" color="textFaint">
        {formatDate(deliverAt, tz)} açılıb · {relativeTime(new Date(letter.createdAt), now)} yazılıb
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sealedContent: { flexGrow: 1, justifyContent: 'space-between' },
  sealedInner: { alignItems: 'center', gap: space.lg, paddingTop: space.xxxl },
  wax: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: color.accentDim,
  },
  actions: { gap: space.md, alignItems: 'center' },
  meta: { gap: space.sm },
  paper: { backgroundColor: color.paper, borderRadius: radius.lg, padding: space.xl, gap: space.md },
  ink: { color: color.ink },
});
