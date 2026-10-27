/**
 * Domain types. These mirror the Postgres schema in supabase/migrations so the mock
 * repository and the future Supabase repository share one shape.
 * Dates named `*At` are ISO-8601 UTC instants; `LocalDate` is a calendar day ('YYYY-MM-DD')
 * in the user's time zone.
 */
export type LocalDate = string;

export type Personality = 'sarcastic' | 'supportive' | 'strict' | 'absurd';

export const PERSONALITIES: readonly Personality[] = ['sarcastic', 'supportive', 'strict', 'absurd'];

/** Days of week as 0 (Sunday) … 6 (Saturday), matching Date#getUTCDay. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Profile = {
  id: string;
  displayName: string;
  timeZone: string;
  locale: string;
  createdAt: string;
};

export type Preferences = {
  /** False until the user has met their future self in onboarding. */
  onboarded: boolean;
  personality: Personality;
  /** What the user calls their future self, e.g. "Böyük Nigar". */
  futureSelfName: string;
  /** The year future you is writing from. */
  futureYear: number;
  notifyMissionReminders: boolean;
  notifyLetterDeliveries: boolean;
  notifyWeeklyVerdict: boolean;
  aiMemoryEnabled: boolean;
  shareStatsWithAi: boolean;
};

export type Goal = {
  id: string;
  title: string;
  why: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type Mission = {
  id: string;
  goalId: string | null;
  title: string;
  days: Weekday[];
  createdAt: string;
  archivedAt: string | null;
};

export type MissionCompletion = {
  id: string;
  missionId: string;
  localDate: LocalDate;
  completedAt: string;
};

export type FocusSession = {
  id: string;
  startedAt: string;
  endedAt: string;
  plannedMinutes: number;
  actualMinutes: number;
};

/** Letter metadata. The body lives separately and is only readable once delivered. */
export type Letter = {
  id: string;
  title: string;
  createdAt: string;
  deliverAt: string;
  deliveryTimeZone: string;
  readAt: string | null;
};

export type ChatRole = 'user' | 'assistant';

/** Where an assistant answer came from: Gemini, or the offline rules when AI is unavailable. */
export type AnswerSource = 'ai' | 'offline';

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  personality: Personality;
  createdAt: string;
  source?: AnswerSource;
};

export type RegretCategory = 'shopping' | 'ex' | 'night' | 'food' | 'procrastination' | 'skip_workout' | 'good' | 'danger' | 'crisis' | 'other';

/** "Peşman olacam?" — one impulse checked with future you. */
export type RegretCheck = {
  id: string;
  text: string;
  category: RegretCategory;
  /** Joke meter, 0–100. Null when the check was answered sincerely (crisis, danger). */
  regret: number | null;
  verdict: string;
  /** What the parallel-universe you did instead. */
  parallel: string | null;
  personality: Personality;
  createdAt: string;
  /** What the user decided after the verdict. */
  outcome: 'skipped' | 'did_it' | null;
  source?: AnswerSource;
};
