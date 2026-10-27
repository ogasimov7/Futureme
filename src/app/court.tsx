import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { PersonaHeader } from '@/components/PersonaHeader';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Chip';
import { InlineNotice } from '@/components/ui/Feedback';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { PreviewBadge, Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { weekStats } from '@/data/selectors';
import { useData } from '@/data/store';
import { addDays, startOfIsoWeek } from '@/domain/dates';
import { awardsFor, FOCUS_TARGET_MINUTES, SCORING_RULES, scoreWeek, shareSummary, verdictFor } from '@/domain/recap';
import { capitalize, formatLocalDate, weekdayName } from '@/lib/format';
import { shareViewAsImage } from '@/lib/shareCard';
import { color, radius, space } from '@/theme/tokens';

type Which = 'this' | 'last';

export default function CourtScreen() {
  const { data, today, mode } = useData();
  const prefs = data.preferences;
  const [which, setWhich] = useState<Which>('this');
  const [showRules, setShowRules] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const cardRef = useRef<ComponentRef<typeof View>>(null);

  const thisWeek = startOfIsoWeek(today);
  const stats = weekStats(data, today, which === 'this' ? thisWeek : addDays(thisWeek, -7));
  const score = scoreWeek(stats);
  const verdict = verdictFor(score);
  const awards = awardsFor(stats);
  const earned = awards.filter((a) => a.earned);
  const range = `${formatLocalDate(stats.weekStart)} – ${formatLocalDate(stats.weekEnd)}`;

  const share = async () => {
    setShareFailed(false);
    if (!(await shareViewAsImage(cardRef, shareSummary(stats, verdict, score, awards)))) setShareFailed(true);
  };

  return (
    <Screen insetTop={false}>
      <Segmented
        options={[
          { value: 'this', label: 'Bu həftə' },
          { value: 'last', label: 'Keçən həftə' },
        ]}
        value={which}
        onChange={setWhich}
      />

      <Animated.View key={which} entering={FadeInDown.duration(360)}>
        {/* Captured as the share image, so it carries its own branding. */}
        <View ref={cardRef} collapsable={false} style={styles.verdict}>
          <PersonaHeader
            name={prefs.futureSelfName}
            year={prefs.futureYear}
            personality={prefs.personality}
            size={44}
            subtitle={`Hakim · ${range}`}
          />
          <Text variant="overline" color="accent">
            Hökm
          </Text>
          <Text variant="h1">{verdict.title}</Text>
          <Text variant="quote" color="textMuted">
            {verdict.ruling}
          </Text>
          <View style={styles.scoreRow}>
            <Text variant="display" style={styles.score} accessibilityLabel={score === null ? 'Bal yoxdur' : `${score} bal, 100-dən`}>
              {score ?? '—'}
            </Text>
            <Text variant="small" color="textMuted">
              / 100
            </Text>
          </View>
          {earned.length > 0 && (
            <View style={styles.badges}>
              {earned.map((a) => (
                <View key={a.id} style={styles.badge}>
                  <Icon name="trophy" size={12} tint={color.onAccent} />
                  <Text variant="caption" color="onAccent">
                    {a.title}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.brand}>
            <Text variant="caption" color="textFaint">
              Future Roast · Gələcək Məhkəməsi
            </Text>
            {mode === 'preview' && <PreviewBadge />}
          </View>
        </View>
      </Animated.View>

      <Button label="Hökmü story kimi paylaş" icon="share" onPress={share} />
      {shareFailed && <InlineNotice tone="error" message="Bu cihazda paylaşmaq mümkün olmadı." />}

      <Button
        label={showRules ? 'Hesablamanı gizlət' : 'Bal necə hesablandı?'}
        icon="info"
        variant="ghost"
        size="sm"
        onPress={() => setShowRules((v) => !v)}
        style={styles.alignStart}
      />
      {showRules && (
        <View style={styles.rules}>
          {SCORING_RULES.map((r) => (
            <Text key={r} variant="small" color="textMuted">
              • {r}
            </Text>
          ))}
          <Text variant="small">
            Bu həftə: {stats.completed}/{stats.scheduled} missiya
            {stats.completionRate === null ? '' : ` (${Math.round(stats.completionRate * 100)}%)`}, {stats.focusMinutes}/
            {FOCUS_TARGET_MINUTES} dəq fokus.
          </Text>
        </View>
      )}

      <Section title="Sübutlar">
        <View style={styles.grid}>
          <Evidence value={`${stats.completed}/${stats.scheduled}`} label="missiya bitib" />
          <Evidence value={`${stats.focusMinutes}`} label="fokus dəqiqəsi" />
          <Evidence value={`${stats.perfectDays}`} label="mükəmməl gün" />
          <Evidence value={`${stats.regretSkips}/${stats.regretChecks}`} label="ağıllı imtina" />
        </View>
        <Text variant="caption" color="textFaint">
          {stats.bestDay ? `Ən yaxşı gün: ${weekdayName(stats.bestDay.date)}. ` : ''}
          {capitalize(weekdayName(stats.countedThrough))} gününə qədər sayılıb. Yalnız Future Roast-da qeyd etdiklərin nəzərə alınır.
        </Text>
      </Section>

      <Section title="Mükafatlar">
        <View style={styles.awards}>
          {awards.map((a) => (
            <View
              key={a.id}
              style={[styles.award, !a.earned && styles.awardLocked]}
              accessible
              accessibilityLabel={`${a.title}, ${a.earned ? 'qazanılıb' : 'qazanılmayıb'}. ${a.criteria} ${a.detail}`}>
              <View style={[styles.medal, a.earned && styles.medalEarned]}>
                <Icon name={a.earned ? 'trophy' : 'lock'} size={16} tint={a.earned ? color.onAccent : color.textFaint} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong" color={a.earned ? 'text' : 'textMuted'}>
                  {a.title}
                </Text>
                <Text variant="caption" color="textFaint">
                  {a.criteria} · {a.detail}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </Section>
    </Screen>
  );
}

function Evidence({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.evidence} accessible accessibilityLabel={`${value} ${label}`}>
      <Text variant="numeral">{value}</Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xs },
  verdict: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.xl,
    backgroundColor: color.hero,
    borderWidth: 1,
    borderColor: color.heroLine,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  score: { color: color.accent, fontSize: 64, lineHeight: 68 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs + 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  brand: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  alignStart: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  rules: { gap: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  evidence: {
    flexGrow: 1,
    flexBasis: '40%',
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.line,
    gap: 2,
  },
  awards: { gap: space.sm },
  award: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.surface,
  },
  awardLocked: { opacity: 0.7 },
  medal: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: color.surfaceRaised },
  medalEarned: { backgroundColor: color.accent },
});
