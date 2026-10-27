import type {
  ChatMessage,
  FocusSession,
  Goal,
  Letter,
  LocalDate,
  Mission,
  MissionCompletion,
  Personality,
  Preferences,
  Profile,
  RegretCheck,
  Weekday,
} from '@/domain/types';

export type Snapshot = {
  profile: Profile;
  preferences: Preferences;
  goals: Goal[];
  missions: Mission[];
  completions: MissionCompletion[];
  focusSessions: FocusSession[];
  letters: Letter[];
  messages: ChatMessage[];
  regretChecks: RegretCheck[];
};

/**
 * The only way screens reach data. `PreviewRepository` implements it in memory for
 * stage 1. A Supabase-backed implementation replaces it in stage 2 without screen changes.
 */
export interface Repository {
  /** 'preview' means seeded demo data. The UI must say so wherever stats appear. */
  readonly mode: 'preview' | 'live';
  load(): Promise<Snapshot>;
  setMissionDone(missionId: string, localDate: LocalDate, done: boolean): Promise<MissionCompletion | null>;
  createGoal(input: { title: string; why: string | null }): Promise<Goal>;
  createMission(input: { title: string; goalId: string | null; days: Weekday[] }): Promise<Mission>;
  createLetter(input: { title: string; body: string; deliverOn: LocalDate; timeZone: string }): Promise<Letter>;
  deleteLetter(id: string): Promise<void>;
  /** Returns null while the letter is sealed. The server enforces this with RLS. */
  readLetterBody(id: string): Promise<string | null>;
  markLetterRead(id: string): Promise<Letter>;
  saveFocusSession(input: Omit<FocusSession, 'id'>): Promise<FocusSession>;
  sendChatMessage(text: string, personality: Personality): Promise<{ user: ChatMessage; reply: ChatMessage }>;
  updatePreferences(patch: Partial<Preferences>): Promise<Preferences>;
  updateProfile(patch: Partial<Pick<Profile, 'displayName'>>): Promise<Profile>;
  /** Asks future you about an impulse. Server-side AI in production; rules in preview. */
  checkRegret(text: string): Promise<RegretCheck>;
  setRegretOutcome(id: string, outcome: NonNullable<RegretCheck['outcome']>): Promise<RegretCheck>;
  exportData(): Promise<unknown>;
  reset(): Promise<Snapshot>;
}
