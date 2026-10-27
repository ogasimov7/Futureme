import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FutureSelfFace } from '@/components/FutureSelfFace';
import { Button } from '@/components/ui/Button';
import { ChipGroup } from '@/components/ui/Chip';
import { InlineNotice, ProgressBar } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Text } from '@/components/ui/Text';
import { useData } from '@/data/store';
import { color, space } from '@/theme/tokens';

const DURATIONS = [15, 25, 45, 60] as const;

/**
 * Timer state is based on timestamps rather than tick counts, so it stays accurate when
 * the app is backgrounded. Paused time is subtracted from elapsed time.
 */
type Running = { kind: 'running'; startedAt: number; pausedMs: number; pausedSince: number | null };
type Phase = { kind: 'setup' } | Running | { kind: 'saved'; minutes: number };

function elapsedAt(p: Running, t: number) {
  return (p.pausedSince ?? t) - p.startedAt - p.pausedMs;
}

export default function FocusScreen() {
  const insets = useSafeAreaInsets();
  const { data, saveFocusSession } = useData();
  const [minutes, setMinutes] = useState<number>(25);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [now, setNow] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const running = phase.kind === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  const plannedMs = minutes * 60_000;
  const elapsedMs = phase.kind === 'running' ? elapsedAt(phase, now) : 0;
  const remainingMs = Math.max(0, plannedMs - elapsedMs);

  const finish = async () => {
    if (phase.kind !== 'running' || saving) return;
    const actualMinutes = Math.floor(Math.min(elapsedAt(phase, Date.now()), plannedMs) / 60_000);
    if (actualMinutes < 1) {
      setPhase({ kind: 'setup' });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveFocusSession({
        startedAt: new Date(phase.startedAt).toISOString(),
        endedAt: new Date().toISOString(),
        plannedMinutes: minutes,
        actualMinutes,
      });
      setPhase({ kind: 'saved', minutes: actualMinutes });
    } catch {
      setError('Sessiya yadda saxlanmadı. Yenidən cəhd et.');
    } finally {
      setSaving(false);
    }
  };

  // Save automatically when the timer reaches zero. Re-armed on every pause/resume.
  useEffect(() => {
    if (phase.kind !== 'running' || phase.pausedSince !== null) return;
    const id = setTimeout(finish, Math.max(0, plannedMs - elapsedAt(phase, Date.now())));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish reads the same phase this effect is keyed on
  }, [phase, plannedMs]);

  const togglePause = () => {
    if (phase.kind !== 'running') return;
    const t = Date.now();
    setNow(t);
    setPhase(
      phase.pausedSince === null
        ? { ...phase, pausedSince: t }
        : { ...phase, pausedMs: phase.pausedMs + (t - phase.pausedSince), pausedSince: null },
    );
  };

  const mm = String(Math.floor(remainingMs / 60_000)).padStart(2, '0');
  const ss = String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, '0');

  return (
    <View style={[styles.root, { paddingTop: insets.top + space.md, paddingBottom: insets.bottom + space.lg }]}>
      <View style={styles.topBar}>
        <Text variant="overline" color="textMuted">
          Fokus sessiyası
        </Text>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Bağla" hitSlop={12}>
          <Icon name="close" size={20} tint={color.textMuted} />
        </Pressable>
      </View>

      <View style={styles.center}>
        <FutureSelfFace personality={data.preferences.personality} size={64} />
        {phase.kind === 'saved' ? (
          <>
            <Text variant="display" align="center">
              {phase.minutes} dəq
            </Text>
            <Text variant="body" color="textMuted" align="center">
              Qeyd olundu. Gələcəkdəki sən bunu hiss etdi.
            </Text>
          </>
        ) : (
          <>
            <Text
              variant="display"
              align="center"
              style={styles.clock}
              accessibilityRole="timer"
              accessibilityLabel={`${Math.ceil(remainingMs / 60_000)} dəqiqə qalıb`}>
              {phase.kind === 'setup' ? `${String(minutes).padStart(2, '0')}:00` : `${mm}:${ss}`}
            </Text>
            {phase.kind === 'running' && (
              <View style={styles.progress}>
                <ProgressBar value={elapsedMs / plannedMs} label="Sessiyanın gedişi" />
              </View>
            )}
            {phase.kind === 'running' && phase.pausedSince !== null && (
              <Text variant="small" color="warning">
                Fasilədə
              </Text>
            )}
          </>
        )}
      </View>

      <View style={styles.controls}>
        {error && <InlineNotice tone="error" message={error} />}
        {phase.kind === 'setup' && (
          <>
            <ChipGroup
              options={DURATIONS.map((d) => ({ value: String(d), label: `${d} dəq` }))}
              value={String(minutes)}
              onChange={(v) => setMinutes(Number(v))}
            />
            <Button
              label="Başla"
              icon="play"
              onPress={() => {
                const t = Date.now();
                setNow(t);
                setPhase({ kind: 'running', startedAt: t, pausedMs: 0, pausedSince: null });
              }}
            />
            <Text variant="caption" color="textFaint" align="center">
              Hələlik tətbiqi açıq saxla. Fonda xəbərdarlıq bildirişlərlə gələcək.
            </Text>
          </>
        )}
        {phase.kind === 'running' && (
          <View style={styles.row}>
            <Button
              label={phase.pausedSince === null ? 'Fasilə' : 'Davam'}
              icon={phase.pausedSince === null ? 'pause' : 'play'}
              variant="secondary"
              onPress={togglePause}
              style={styles.flex}
            />
            <Button label={elapsedMs < 60_000 ? 'Ləğv et' : 'Bitir'} onPress={finish} loading={saving} style={styles.flex} />
          </View>
        )}
        {phase.kind === 'saved' && <Button label="Hazırdır" onPress={() => router.back()} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg, paddingHorizontal: space.lg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  clock: { fontSize: 76, lineHeight: 84, fontVariant: ['tabular-nums'] },
  progress: { width: '70%' },
  controls: { gap: space.lg, width: '100%', maxWidth: 480, alignSelf: 'center' },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
});
