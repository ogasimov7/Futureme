import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { PersonaHeader } from '@/components/PersonaHeader';
import { InlineNotice } from '@/components/ui/Feedback';
import { ListRow, RowGroup, ToggleRow } from '@/components/ui/Form';
import { Screen } from '@/components/ui/Screen';
import { PreviewBadge, Section } from '@/components/ui/Section';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/data/auth';
import { useData } from '@/data/store';
import { PERSONALITY_INFO } from '@/domain/futureSelf';
import type { Preferences } from '@/domain/types';
import { space } from '@/theme/tokens';

type Notice = { tone: 'error' | 'success' | 'info'; message: string } | null;

export default function ProfileScreen() {
  const { data, mode, updatePreferences, exportData, resetPreview } = useData();
  const { session, signOut } = useAuth();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const prefs = data.preferences;
  const [notice, setNotice] = useState<Notice>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const set = (patch: Partial<Preferences>) => {
    updatePreferences(patch).catch(() => setNotice({ tone: 'error', message: 'Ayar yadda saxlanmadı. Yenidən cəhd et.' }));
  };

  const runExport = async () => {
    setNotice(null);
    try {
      const json = JSON.stringify(await exportData(), null, 2);
      await Share.share({ message: json, title: 'Future Roast məlumat ixracı' });
    } catch {
      setNotice({ tone: 'error', message: 'İxrac alınmadı və ya bu cihazda paylaşmaq mümkün deyil.' });
    }
  };

  const runReset = async () => {
    if (!confirmReset) return setConfirmReset(true);
    setConfirmReset(false);
    // Clears onboarding too, so the tab layout sends the user back to the start.
    await resetPreview();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <PersonaHeader name={prefs.futureSelfName} year={prefs.futureYear} personality={prefs.personality} size={64} />
        {mode === 'preview' && <PreviewBadge />}
      </View>

      {notice && <InlineNotice tone={notice.tone} message={notice.message} />}

      <Section title="Gələcəkdəki sən">
        <RowGroup>
          <ListRow
            icon="sparkle"
            label="Xüsusiyyətləri dəyiş"
            detail={`${PERSONALITY_INFO[prefs.personality].label} · ${prefs.futureYear} · ${prefs.futureSelfName} · sən: ${data.profile.displayName || '—'}`}
            onPress={() => router.push('/persona')}
          />
        </RowGroup>
      </Section>

      <Section title="Bildirişlər">
        <RowGroup>
          <ToggleRow icon="bell" label="Missiya xatırlatmaları" value={prefs.notifyMissionReminders} onChange={(v) => set({ notifyMissionReminders: v })} />
          <ToggleRow icon="letters" label="Məktub çatdırılması" value={prefs.notifyLetterDeliveries} onChange={(v) => set({ notifyLetterDeliveries: v })} />
          <ToggleRow icon="gavel" label="Həftəlik hökm" value={prefs.notifyWeeklyVerdict} onChange={(v) => set({ notifyWeeklyVerdict: v })} />
        </RowGroup>
        <Text variant="caption" color="textFaint">
          Bunlar seçimlərini yadda saxlayır. Push bildirişlər hələ aktiv deyil. Aktiv olanda əvvəlcə icazə istəyəcəyik.
          İcazə verməsən də, məktublar tətbiqdə vaxtında açılacaq.
        </Text>
      </Section>

      <Section title="Məxfilik">
        <RowGroup>
          {/* AI memory (user-approved facts) is not built yet, so its toggle stays hidden until it is. */}
          <ToggleRow
            icon="shield"
            label="Vərdiş statistikası söhbətdə istifadə olunsun"
            detail="Yalnız missiya və fokus cəmləri"
            value={prefs.shareStatsWithAi}
            onChange={(v) => set({ shareStatsWithAi: v })}
          />
        </RowGroup>
        <Text variant="caption" color="textFaint">
          AI cavabları Google Gemini ilə yaradılır. Yazdıqların cavab üçün Google-a göndərilir. Pulsuz versiyada Google
          onları məhsullarını yaxşılaşdırmaq üçün istifadə edə və əməkdaşları oxuya bilər. Şəxsi məlumat (parol, kart,
          ünvan, sağlamlıq) yazma.
        </Text>
      </Section>

      <Section title="Ümumi">
        <RowGroup>
          <ListRow icon="globe" label="Dil" value="Azərbaycanca" detail="İngilis dili sonra əlavə olunacaq" />
          <ListRow icon="clock" label="Saat qurşağı" value={data.profile.timeZone} detail="Cihazına uyğun" />
        </RowGroup>
      </Section>

      <Section title="Məlumatların">
        <RowGroup>
          <ListRow
            icon="download"
            label="Məlumatlarımı ixrac et"
            detail={
              mode === 'preview'
                ? 'Hamısı JSON kimi, möhürlü məktublar da daxil'
                : 'JSON kimi. Möhürlü məktubların mətni açılana qədər daxil deyil'
            }
            onPress={runExport}
          />
          {mode === 'preview' && (
            <ListRow
              icon="refresh"
              label={confirmReset ? 'Təsdiq üçün yenidən toxun' : 'Sıfırdan başla'}
              detail="Demo məlumatı bərpa edir və tanışlığı yenidən göstərir"
              onPress={runReset}
            />
          )}
          <ListRow
            icon="trash"
            label="Hesabı sil"
            detail={mode === 'preview' ? 'Hesab yarandıqdan sonra mümkün olacaq' : 'Növbəti yenilənmədə əlavə olunacaq'}
            tone="danger"
            disabled
          />
        </RowGroup>
      </Section>

      <Section title="Hesab">
        <RowGroup>
          {session ? (
            <>
              <ListRow icon="profile" label="E-poçt" value={session.user.email ?? '—'} />
              <ListRow
                icon="key"
                label={confirmSignOut ? 'Çıxmaq üçün yenidən toxun' : 'Çıxış'}
                detail="Məlumatların hesabında qalır"
                onPress={() => (confirmSignOut ? signOut() : setConfirmSignOut(true))}
              />
            </>
          ) : (
            <ListRow icon="key" label="Daxil ol" detail="Hesablar qoşulmayıb. Məlumatlar yalnız bu cihazdadır." disabled />
          )}
        </RowGroup>
      </Section>

      <Text variant="caption" color="textFaint" align="center">
        Future Roast {Constants.expoConfig?.version ?? ''} · Peşəkar yardımı əvəz etmir. Çətin vaxt keçirirsənsə, etibar
        etdiyin birinə və ya mütəxəssisə müraciət et.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.md },
});
