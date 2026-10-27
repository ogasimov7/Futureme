import type { Session } from '@supabase/supabase-js';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { deviceTimeZone } from '@/domain/dates';

import { supabase } from './supabase';

type AuthValue = {
  /** False when Supabase isn't configured: the app runs on preview data, no sign-in. */
  enabled: boolean;
  /** Undefined while the stored session is being restored. */
  session: Session | null | undefined;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

/** Supabase auth errors → short Azerbaijani messages. */
function explain(error: { message?: string; status?: number; code?: string }): string {
  const m = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  if (error.status === 429 || m.includes('rate limit') || m.includes('over_email_send_rate_limit')) {
    return 'Çox tez-tez kod istənildi. Bir az gözlə və yenidən cəhd et.';
  }
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) return 'Kod yanlışdır və ya vaxtı keçib.';
  if (m.includes('email')) return 'E-poçt ünvanını yoxla.';
  if (m.includes('network') || m.includes('fetch')) return 'İnternet bağlantısını yoxla.';
  return 'Bir şey alınmadı. Yenidən cəhd et.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    enabled: supabase !== null,
    session,
    async sendCode(email) {
      if (!supabase) return;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        // New accounts get the device time zone, so "today" is right from the first mission.
        options: { shouldCreateUser: true, data: { time_zone: deviceTimeZone() } },
      });
      if (error) throw new Error(explain(error));
    },
    async verifyCode(email, code) {
      if (!supabase) return;
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw new Error(explain(error));
    },
    async signOut() {
      await supabase?.auth.signOut();
    },
  };

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
  const auth = use(AuthContext);
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>.');
  return auth;
}
