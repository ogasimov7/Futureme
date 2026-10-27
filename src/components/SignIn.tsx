import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FutureSelfFace } from '@/components/FutureSelfFace';
import { Button } from '@/components/ui/Button';
import { InlineNotice } from '@/components/ui/Feedback';
import { TextField } from '@/components/ui/Form';
import { Text } from '@/components/ui/Text';
import { useAuth } from '@/data/auth';
import { color, maxContentWidth, space } from '@/theme/tokens';

const RESEND_SECONDS = 60;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Passwordless sign-in: email → one-time code. New emails get an account automatically. */
export function SignIn() {
  const insets = useSafeAreaInsets();
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const send = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL.test(trimmed)) {
      setError('E-poçt ünvanını düzgün yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendCode(trimmed);
      setEmail(trimmed);
      setStep('code');
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kod göndərilmədi.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const digits = code.replace(/\D/g, '');
    if (digits.length < 6) {
      setError('Məktubdakı kodu tam yaz.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyCode(email, digits);
      // The auth listener swaps this screen for the app.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kod təsdiqlənmədi.');
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.xxxl, paddingBottom: insets.bottom + space.xl }]}
        keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeIn.duration(500)} style={styles.hero}>
          <FutureSelfFace personality="sarcastic" size={96} />
          <Text variant="display" align="center">
            Future Roast
          </Text>
          <Text variant="body" color="textMuted" align="center">
            Gələcəkdəki sən artıq gözləyir. Əvvəlcə kim olduğunu təsdiqlə.
          </Text>
        </Animated.View>

        {step === 'email' ? (
          <Animated.View key="email" entering={FadeInDown.duration(300)} style={styles.form}>
            <TextField
              label="E-poçt"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              placeholder="sen@nümunə.az"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={send}
              maxLength={120}
              hint="Parol yoxdur. E-poçtuna birdəfəlik kod göndərəcəyik."
            />
            {error && <InlineNotice tone="error" message={error} />}
            <Button label="Kod göndər" onPress={send} loading={busy} />
          </Animated.View>
        ) : (
          <Animated.View key="code" entering={FadeInDown.duration(300)} style={styles.form}>
            <Text variant="small" color="textMuted">
              Kodu bu ünvana göndərdik: <Text variant="smallStrong">{email}</Text>. Spam qovluğunu da yoxla.
            </Text>
            <TextField
              label="Kod"
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, '').slice(0, 10));
                setError(null);
              }}
              placeholder="123456"
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="done"
              onSubmitEditing={verify}
              autoFocus
            />
            {error && <InlineNotice tone="error" message={error} />}
            <Button label="Daxil ol" onPress={verify} loading={busy} />
            <View style={styles.row}>
              <Button
                label={cooldown > 0 ? `Yenidən göndər (${cooldown})` : 'Yenidən göndər'}
                variant="ghost"
                size="sm"
                disabled={cooldown > 0 || busy}
                onPress={send}
              />
              <Button
                label="E-poçtu dəyiş"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setStep('email');
                  setCode('');
                  setError(null);
                }}
              />
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  content: { flexGrow: 1, paddingHorizontal: space.lg, gap: space.xxl, width: '100%', maxWidth: maxContentWidth, alignSelf: 'center' },
  hero: { alignItems: 'center', gap: space.md },
  form: { gap: space.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
