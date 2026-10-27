import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MissionRow } from '@/components/MissionRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { PreviewBadge, Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { missionViews, weekStats, type MissionView } from '@/data/selectors';
import { useData } from '@/data/store';
import { addDays, localDateOf, startOfIsoWeek } from '@/domain/dates';
import { scoreWeek, verdictFor } from '@/domain/recap';
import { isScheduledOn } from '@/domain/streaks';
import type { Mission, Weekday } from '@/domain/types';
import { formatLocalDate } from '@/lib/format';
import { color, radius, space } from '@/theme/tokens';

// Index 0 = Sunday, matching weekdayOf.
const DAY_LETTERS = ['B', 'Be', 'Ça', 'Ç', 'Ca', 'C', 'Ş'];

export default function HabitsScreen() {
  const { data, today, mode, toggleMission } = useData();
  const views = missionViews(data, today);
  const week = weekStats(data, today);
  const verdict = verdictFor(scoreWeek(week));
  const activeGoals = data.goals.filter((g) => !g.archivedAt);
  const ungrouped = views.filter((v) => !v.mission.goalId || !activeGoals.some((g) => g.id === v.mission.goalId));

  const row = (v: MissionView) => (
    <MissionRow
      key={v.mission.id}
      title={v.mission.title}
      done={v.done}
      streak={v.streak}
      subtitle={v.scheduledToday ? scheduleLabel(v.mission) : `Bu gün istirahət · ${scheduleLabel(v.mission)}`}
      disabled={!v.scheduledToday && !v.done}
      onToggle={() => toggleMission(v.mission.id, today)}
    />
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="h1">Vərdişlər</Text>
        {mode === 'preview' && <PreviewBadge />}
      </View>

      <WeekStrip today={today} data={data} />

      <View style={styles.tiles}>
        <Card onPress={() => router.push('/focus')} style={styles.tile} accessibilityLabel={`Fokus sessiyası. Bu həftə ${week.focusMinutes} dəqiqə. Başlat.`}>
          <Icon name="timer" size={22} tint={color.accent} />
          <Text variant="numeral">{week.focusMinutes}</Text>
          <Text variant="caption" color="textMuted">
            bu həftə fokus dəqiqəsi
          </Text>
          <Text variant="smallStrong" color="accent">
            Sessiya başlat →
          </Text>
        </Card>
        <Card onPress={() => router.push('/court')} tone="hero" style={styles.tile} accessibilityLabel={`Gələcək Məhkəməsi. Hazırkı hökm: ${verdict.title}. Aç.`}>
          <Icon name="gavel" size={22} tint={color.accent} />
          <Text variant="h3" numberOfLines={2}>
            {verdict.title}
          </Text>
          <Text variant="caption" color="textMuted">
            Gələcək Məhkəməsi, bu həftə
          </Text>
          <Text variant="smallStrong" color="accent">
            Hökmə bax →
          </Text>
        </Card>
      </View>

      {activeGoals.length === 0 && views.length === 0 ? (
        <EmptyState
          icon="habits"
          title="Bir hədəflə başla"
          body="Hədəf 'niyə'dir. Missiya isə hər günkü kiçik 'nə'. Gələcəkdəki sən yalnız yazdıqlarını mühakimə edir."
          action={{ label: 'Hədəf yarat', onPress: () => router.push('/goals/new') }}
        />
      ) : (
        <>
          {activeGoals.map((goal) => {
            const missions = views.filter((v) => v.mission.goalId === goal.id);
            return (
              <Section
                key={goal.id}
                title={goal.title}
                aside={
                  <Button
                    label="Missiya"
                    icon="plus"
                    variant="ghost"
                    size="sm"
                    onPress={() => router.push({ pathname: '/missions/new', params: { goalId: goal.id } })}
                  />
                }>
                <Card style={styles.tight}>
                  {goal.why && (
                    <Text variant="small" color="textFaint" style={styles.why}>
                      {goal.why}
                    </Text>
                  )}
                  {missions.length > 0 ? (
                    missions.map(row)
                  ) : (
                    <Text variant="small" color="textMuted" style={styles.why}>
                      Hələ missiya yoxdur. Pis gündə də edə biləcəyin kiçik birini əlavə et.
                    </Text>
                  )}
                </Card>
              </Section>
            );
          })}
          {ungrouped.length > 0 && (
            <Section title="Digər missiyalar">
              <Card style={styles.tight}>{ungrouped.map(row)}</Card>
            </Section>
          )}
          <View style={styles.addRow}>
            <Button label="Yeni hədəf" icon="plus" variant="secondary" size="sm" onPress={() => router.push('/goals/new')} />
            <Button label="Yeni missiya" icon="plus" variant="secondary" size="sm" onPress={() => router.push('/missions/new')} />
          </View>
        </>
      )}

      <Text variant="caption" color="textFaint">
        Future Roast yalnız burada qeyd etdiklərini sayır. Ekran vaxtına və digər tətbiqlərə çıxışı yoxdur.
      </Text>
    </Screen>
  );
}

function scheduleLabel(mission: Mission) {
  if (mission.days.length === 7) return 'Hər gün';
  if (mission.days.length === 5 && [1, 2, 3, 4, 5].every((d) => mission.days.includes(d as Weekday))) return 'İş günləri';
  return [...mission.days]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((d) => ['B.', 'B.e.', 'Ç.a.', 'Ç.', 'C.a.', 'C.', 'Ş.'][d])
    .join(' · ');
}

function WeekStrip({ today, data }: { today: string; data: ReturnType<typeof useData>['data'] }) {
  const start = startOfIsoWeek(today);
  const missions = data.missions.filter((m) => !m.archivedAt);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <View style={styles.strip} accessibilityLabel="Bu həftənin günlər üzrə missiya icrası">
      {days.map((day) => {
        const due = missions.filter(
          (m) => isScheduledOn(m, day) && localDateOf(new Date(m.createdAt), data.profile.timeZone) <= day,
        );
        const done = due.filter((m) => data.completions.some((c) => c.missionId === m.id && c.localDate === day)).length;
        const ratio = due.length ? done / due.length : 0;
        const future = day > today;
        const isToday = day === today;
        return (
          <View
            key={day}
            style={styles.day}
            accessible
            accessibilityLabel={`${formatLocalDate(day, { weekday: 'long' })}: ${future ? 'hələ gəlməyib' : `${done}/${due.length} hazırdır`}`}>
            <Text variant="caption" color={isToday ? 'accent' : 'textFaint'}>
              {DAY_LETTERS[new Date(`${day}T12:00:00Z`).getUTCDay()]}
            </Text>
            <View style={[styles.dayCell, isToday && styles.dayToday]}>
              <View
                style={[
                  styles.dayFill,
                  { height: `${future ? 0 : Math.max(ratio * 100, done > 0 ? 12 : 0)}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.sm },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: space.xs },
  tight: { paddingVertical: space.sm, gap: 0 },
  why: { paddingTop: space.sm, paddingBottom: space.xs },
  addRow: { flexDirection: 'row', gap: space.md },
  strip: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  day: { flex: 1, alignItems: 'center', gap: space.xs },
  dayCell: {
    width: '100%',
    maxWidth: 40,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.line,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  dayToday: { borderColor: color.accent },
  dayFill: { width: '100%', backgroundColor: color.accent },
});
