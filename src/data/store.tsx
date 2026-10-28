import { createContext, use, useCallback, useEffect, useState, type ReactNode } from 'react';

import { localDateOf } from '@/domain/dates';
import type { LocalDate, Personality, Preferences, Profile, RegretCheck } from '@/domain/types';

import { aiHealth } from './ai';
import type { Repository, Snapshot } from './repository';

type Status = 'loading' | 'ready' | 'error';

type StoreValue = {
  status: Status;
  error: string | null;
  data: Snapshot | null;
  mode: Repository['mode'];
  /** The user's current local date; refreshes when the day rolls over. */
  today: LocalDate;
  /** Whether the AI server is configured: null = unknown/unreachable. */
  aiAvailable: boolean | null;
  refreshAiStatus: () => void;
  reload: () => void;
  toggleMission: (missionId: string, localDate: LocalDate) => Promise<void>;
  createGoal: Repository['createGoal'];
  createMission: Repository['createMission'];
  createLetter: Repository['createLetter'];
  deleteLetter: Repository['deleteLetter'];
  readLetterBody: Repository['readLetterBody'];
  markLetterRead: (id: string) => Promise<void>;
  saveFocusSession: Repository['saveFocusSession'];
  sendChatMessage: (text: string, personality: Personality) => Promise<void>;
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;
  updateProfile: (patch: Partial<Pick<Profile, 'displayName'>>) => Promise<void>;
  checkRegret: Repository['checkRegret'];
  setRegretOutcome: (id: string, outcome: NonNullable<RegretCheck['outcome']>) => Promise<void>;
  exportData: Repository['exportData'];
  resetPreview: (options?: { empty?: boolean }) => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

/** One store per data source: preview (no account) or the signed-in user's Supabase data. */
export function StoreProvider({ children, repository }: { children: ReactNode; repository: Repository }) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loadCount, setLoadCount] = useState(0);
  const timeZone = data?.profile.timeZone ?? 'UTC';
  const [now, setNow] = useState(() => new Date());
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);

  // Stable identity: screens pass this to useFocusEffect, which re-runs on every new function.
  const refreshAiStatus = useCallback(() => {
    aiHealth().then(setAiAvailable);
  }, []);
  useEffect(refreshAiStatus, [refreshAiStatus]);

  useEffect(() => {
    let cancelled = false;
    repository
      .load()
      .then((snapshot) => {
        if (cancelled) return;
        setData(snapshot);
        setStatus('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Something went wrong.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [loadCount, repository]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const patch = (fn: (s: Snapshot) => Snapshot) => setData((s) => (s ? fn(s) : s));

  const value: StoreValue = {
    status,
    error,
    data,
    mode: repository.mode,
    today: localDateOf(now, timeZone),
    aiAvailable,
    refreshAiStatus,
    reload: () => {
      setStatus('loading');
      setLoadCount((n) => n + 1);
    },

    async toggleMission(missionId, localDate) {
      const wasDone = data?.completions.some((c) => c.missionId === missionId && c.localDate === localDate) ?? false;
      const without = (s: Snapshot) => s.completions.filter((c) => !(c.missionId === missionId && c.localDate === localDate));
      const optimistic = { id: `optimistic-${missionId}-${localDate}`, missionId, localDate, completedAt: new Date().toISOString() };
      patch((s) => ({ ...s, completions: wasDone ? without(s) : [...without(s), optimistic] }));
      try {
        const saved = await repository.setMissionDone(missionId, localDate, !wasDone);
        patch((s) => ({ ...s, completions: saved ? [...without(s), saved] : without(s) }));
      } catch (e) {
        // Roll back so the checkbox never shows a state the server didn't accept.
        patch((s) => ({ ...s, completions: wasDone ? [...without(s), optimistic] : without(s) }));
        throw e;
      }
    },

    async createGoal(input) {
      const goal = await repository.createGoal(input);
      patch((s) => ({ ...s, goals: [...s.goals, goal] }));
      return goal;
    },

    async createMission(input) {
      const mission = await repository.createMission(input);
      patch((s) => ({ ...s, missions: [...s.missions, mission] }));
      return mission;
    },

    async createLetter(input) {
      const letter = await repository.createLetter(input);
      patch((s) => ({ ...s, letters: [...s.letters, letter] }));
      return letter;
    },

    async deleteLetter(id) {
      await repository.deleteLetter(id);
      patch((s) => ({ ...s, letters: s.letters.filter((l) => l.id !== id) }));
    },

    readLetterBody: (id) => repository.readLetterBody(id),

    async markLetterRead(id) {
      const letter = await repository.markLetterRead(id);
      patch((s) => ({ ...s, letters: s.letters.map((l) => (l.id === id ? letter : l)) }));
    },

    async saveFocusSession(input) {
      const session = await repository.saveFocusSession(input);
      patch((s) => ({ ...s, focusSessions: [...s.focusSessions, session] }));
      return session;
    },

    async sendChatMessage(text, personality) {
      const { user, reply } = await repository.sendChatMessage(text, personality);
      patch((s) => ({ ...s, messages: [...s.messages, user, reply] }));
      if (reply.source === 'ai') setAiAvailable(true);
    },

    async updatePreferences(changes) {
      patch((s) => ({ ...s, preferences: { ...s.preferences, ...changes } }));
      const saved = await repository.updatePreferences(changes);
      patch((s) => ({ ...s, preferences: saved }));
    },

    async updateProfile(changes) {
      const saved = await repository.updateProfile(changes);
      patch((s) => ({ ...s, profile: saved }));
    },

    async checkRegret(text) {
      const check = await repository.checkRegret(text);
      patch((s) => ({ ...s, regretChecks: [...s.regretChecks, check] }));
      if (check.source === 'ai') setAiAvailable(true);
      return check;
    },

    async setRegretOutcome(id, outcome) {
      const saved = await repository.setRegretOutcome(id, outcome);
      patch((s) => ({ ...s, regretChecks: s.regretChecks.map((c) => (c.id === id ? saved : c)) }));
    },

    exportData: () => repository.exportData(),

    async resetPreview(options) {
      setData(await repository.reset(options));
    },
  };

  return <StoreContext value={value}>{children}</StoreContext>;
}

export function useStore() {
  const store = use(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>.');
  return store;
}

/** For screens that render after the root gate, where data is guaranteed. */
export function useData() {
  const { data, ...rest } = useStore();
  if (!data) throw new Error('useData called before data loaded.');
  return { ...rest, data };
}
