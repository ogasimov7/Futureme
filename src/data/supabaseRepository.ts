import type { SupabaseClient } from '@supabase/supabase-js';

import { deviceTimeZone, localDateOf } from '@/domain/dates';
import { assessImpulse, IMPULSE_MAX_LENGTH } from '@/domain/regret';
import type {
  ChatMessage,
  FocusSession,
  Goal,
  Letter,
  Mission,
  MissionCompletion,
  Personality,
  Preferences,
  Profile,
  RegretCheck,
  Weekday,
} from '@/domain/types';
import { fromYear } from '@/lib/format';

import { aiChat, aiRegret, type AiPersona } from './ai';
import { previewReply } from './previewResponder';
import type { Repository, Snapshot } from './repository';
import { splitLetters, todaysMissions, weekStats } from './selectors';

/** How far back history is loaded; older rows stay in the database and in exports. */
const HISTORY_DAYS = 120;

// Row shapes (snake_case, as stored). Kept local: no generated types yet.
type Row = Record<string, unknown>;
const s = (v: unknown) => v as string;
const sn = (v: unknown) => (v ?? null) as string | null;

const toProfile = (r: Row): Profile => ({
  id: s(r.id),
  displayName: s(r.display_name),
  timeZone: s(r.time_zone),
  locale: s(r.locale),
  createdAt: s(r.created_at),
});
const toPreferences = (r: Row): Preferences => ({
  onboarded: Boolean(r.onboarded),
  personality: r.personality as Personality,
  futureSelfName: s(r.future_self_name),
  futureYear: Number(r.future_year),
  notifyMissionReminders: Boolean(r.notify_mission_reminders),
  notifyLetterDeliveries: Boolean(r.notify_letter_deliveries),
  notifyWeeklyVerdict: Boolean(r.notify_weekly_verdict),
  aiMemoryEnabled: Boolean(r.ai_memory_enabled),
  shareStatsWithAi: Boolean(r.share_stats_with_ai),
});
const PREF_COLUMNS: Record<keyof Preferences, string> = {
  onboarded: 'onboarded',
  personality: 'personality',
  futureSelfName: 'future_self_name',
  futureYear: 'future_year',
  notifyMissionReminders: 'notify_mission_reminders',
  notifyLetterDeliveries: 'notify_letter_deliveries',
  notifyWeeklyVerdict: 'notify_weekly_verdict',
  aiMemoryEnabled: 'ai_memory_enabled',
  shareStatsWithAi: 'share_stats_with_ai',
};
const toGoal = (r: Row): Goal => ({ id: s(r.id), title: s(r.title), why: sn(r.why), createdAt: s(r.created_at), archivedAt: sn(r.archived_at) });
const toMission = (r: Row): Mission => ({
  id: s(r.id),
  goalId: sn(r.goal_id),
  title: s(r.title),
  days: (r.days as number[]).map((d) => d as Weekday),
  createdAt: s(r.created_at),
  archivedAt: sn(r.archived_at),
});
const toCompletion = (r: Row): MissionCompletion => ({
  id: s(r.id),
  missionId: s(r.mission_id),
  localDate: s(r.local_date),
  completedAt: s(r.completed_at),
});
const toFocus = (r: Row): FocusSession => ({
  id: s(r.id),
  startedAt: s(r.started_at),
  endedAt: s(r.ended_at),
  plannedMinutes: Number(r.planned_minutes),
  actualMinutes: Number(r.actual_minutes),
});
const toLetter = (r: Row): Letter => ({
  id: s(r.id),
  title: s(r.title),
  createdAt: s(r.created_at),
  deliverAt: s(r.deliver_at),
  deliveryTimeZone: s(r.delivery_time_zone),
  readAt: sn(r.read_at),
});
const toMessage = (r: Row): ChatMessage => ({
  id: s(r.id),
  role: r.role as ChatMessage['role'],
  content: s(r.content),
  personality: r.personality as Personality,
  createdAt: s(r.created_at),
  source: (r.source ?? undefined) as ChatMessage['source'],
});
const toRegret = (r: Row): RegretCheck => ({
  id: s(r.id),
  text: s(r.text),
  category: r.category as RegretCheck['category'],
  regret: r.regret === null ? null : Number(r.regret),
  verdict: s(r.verdict),
  parallel: sn(r.parallel),
  personality: r.personality as Personality,
  createdAt: s(r.created_at),
  outcome: (r.outcome ?? null) as RegretCheck['outcome'],
  source: r.source as RegretCheck['source'],
});

/** Throws a short, user-facing error; the details go to the dev console. */
function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error || result.data === null) {
    console.warn(`[supabase] ${what}: ${result.error?.message ?? 'no data'}`);
    throw new Error('Serverlə əlaqə alınmadı. Yenidən cəhd et.');
  }
  return result.data;
}

/**
 * Live data in Supabase for the signed-in user. Every query is also limited by RLS on the
 * server, so a bug here can't expose another user's rows.
 */
export class SupabaseRepository implements Repository {
  readonly mode = 'live' as const;
  private snapshotCache: Snapshot | null = null;
  private conversationId: string | null = null;

  constructor(
    private readonly db: SupabaseClient,
    private readonly userId: string,
  ) {}

  async load(): Promise<Snapshot> {
    const since = new Date(Date.now() - HISTORY_DAYS * 86_400_000).toISOString();
    const sinceDate = since.slice(0, 10);
    const [profile, prefs, goals, missions, completions, focus, letters, conversation, regrets] = await Promise.all([
      this.db.from('profiles').select('*').eq('id', this.userId).single(),
      this.db.from('user_preferences').select('*').eq('user_id', this.userId).single(),
      this.db.from('goals').select('*').order('created_at'),
      this.db.from('missions').select('*').order('created_at'),
      this.db.from('mission_completions').select('*').gte('local_date', sinceDate),
      this.db.from('focus_sessions').select('*').gte('started_at', since),
      this.db.from('letters').select('*').order('deliver_at'),
      this.db.from('conversations').select('id').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      this.db.from('regret_checks').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    let profileRow = must(profile, 'profile');
    // Keep the server's idea of "today" (used by RLS for completions) in the user's zone.
    const tz = deviceTimeZone();
    if (profileRow.time_zone !== tz) {
      const updated = await this.db.from('profiles').update({ time_zone: tz }).eq('id', this.userId).select().single();
      if (!updated.error && updated.data) profileRow = updated.data;
    }

    this.conversationId = (conversation.data?.id as string | undefined) ?? null;
    let messages: ChatMessage[] = [];
    if (this.conversationId) {
      const rows = await this.db
        .from('messages')
        .select('*')
        .eq('conversation_id', this.conversationId)
        .order('created_at', { ascending: false })
        .limit(100);
      messages = must(rows, 'messages').map(toMessage).reverse();
    }

    this.snapshotCache = {
      profile: toProfile(profileRow),
      preferences: toPreferences(must(prefs, 'preferences')),
      goals: must(goals, 'goals').map(toGoal),
      missions: must(missions, 'missions').map(toMission),
      completions: must(completions, 'completions').map(toCompletion),
      focusSessions: must(focus, 'focus').map(toFocus),
      letters: must(letters, 'letters').map(toLetter),
      messages,
      regretChecks: must(regrets, 'regret checks').map(toRegret).reverse(),
    };
    // A copy: this cache is updated in place for AI context and must not alias React state.
    return JSON.parse(JSON.stringify(this.snapshotCache)) as Snapshot;
  }

  /** The latest known state, for AI context. Screens hold the authoritative copy in the store. */
  private get state(): Snapshot {
    if (!this.snapshotCache) throw new Error('load() must run first');
    return this.snapshotCache;
  }

  private persona(): AiPersona {
    const { personality, futureYear, futureSelfName } = this.state.preferences;
    return { personality, futureYear, futureSelfName, userName: this.state.profile.displayName };
  }

  private chatContext(): string | undefined {
    if (!this.state.preferences.shareStatsWithAi) return undefined;
    const now = new Date();
    const today = localDateOf(now, this.state.profile.timeZone);
    const missions = todaysMissions(this.state, today);
    const done = missions.filter((m) => m.done);
    const week = weekStats(this.state, today);
    return [
      `Bu gün: ${done.length}/${missions.length} missiya hazırdır.`,
      missions.length > done.length ? `Qalan missiyalar: ${missions.filter((m) => !m.done).map((m) => m.mission.title).join(', ')}.` : null,
      `Ən uzun aktiv seriya: ${Math.max(0, ...missions.map((m) => m.streak))} gün.`,
      `Bu həftə fokus: ${week.focusMinutes} dəqiqə.`,
      `Yolda ${splitLetters(this.state, now).sealed.length} möhürlü məktub var.`,
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 600);
  }

  async setMissionDone(missionId: string, localDate: string, done: boolean) {
    if (!done) {
      const r = await this.db.from('mission_completions').delete().eq('mission_id', missionId).eq('local_date', localDate);
      if (r.error) must(r, 'uncomplete mission');
      this.state.completions = this.state.completions.filter((c) => !(c.missionId === missionId && c.localDate === localDate));
      return null;
    }
    const r = await this.db
      .from('mission_completions')
      .upsert({ user_id: this.userId, mission_id: missionId, local_date: localDate }, { onConflict: 'mission_id,local_date' })
      .select()
      .single();
    const completion = toCompletion(must(r, 'complete mission'));
    this.state.completions = [...this.state.completions.filter((c) => c.id !== completion.id), completion];
    return completion;
  }

  async createGoal(input: { title: string; why: string | null }) {
    const r = await this.db.from('goals').insert({ user_id: this.userId, title: input.title, why: input.why }).select().single();
    const goal = toGoal(must(r, 'create goal'));
    this.state.goals = [...this.state.goals, goal];
    return goal;
  }

  async createMission(input: Parameters<Repository['createMission']>[0]) {
    const r = await this.db
      .from('missions')
      .insert({ user_id: this.userId, goal_id: input.goalId, title: input.title, days: input.days })
      .select()
      .single();
    const mission = toMission(must(r, 'create mission'));
    this.state.missions = [...this.state.missions, mission];
    return mission;
  }

  async createLetter(input: Parameters<Repository['createLetter']>[0]) {
    // The server computes deliver_at and enforces the delivery rules.
    const r = await this.db
      .rpc('create_letter', { p_title: input.title, p_body: input.body, p_deliver_on: input.deliverOn, p_tz: input.timeZone })
      .single();
    if (r.error?.message.includes('at least a day')) throw new Error('Məktubun yola düşməsi üçün ən azı bir gün lazımdır.');
    if (r.error?.message.includes('daily letter limit')) throw new Error('Bu gün üçün məktub limiti doldu. Sabah yenə yaz.');
    const letter = toLetter(must(r as { data: Row | null; error: { message: string } | null }, 'create letter'));
    this.state.letters = [...this.state.letters, letter];
    return letter;
  }

  async deleteLetter(id: string) {
    const r = await this.db.from('letters').delete().eq('id', id);
    if (r.error) must(r, 'delete letter');
    this.state.letters = this.state.letters.filter((l) => l.id !== id);
  }

  async readLetterBody(id: string) {
    // RLS returns no row while the letter is sealed.
    const r = await this.db.from('letter_contents').select('body').eq('letter_id', id).maybeSingle();
    if (r.error) must(r, 'read letter');
    return (r.data?.body as string | undefined) ?? null;
  }

  async markLetterRead(id: string) {
    const r = await this.db.rpc('mark_letter_read', { p_letter_id: id }).single();
    const letter = toLetter(must(r as { data: Row | null; error: { message: string } | null }, 'mark letter read'));
    this.state.letters = this.state.letters.map((l) => (l.id === id ? letter : l));
    return letter;
  }

  async saveFocusSession(input: Parameters<Repository['saveFocusSession']>[0]) {
    const r = await this.db
      .from('focus_sessions')
      .insert({
        user_id: this.userId,
        started_at: input.startedAt,
        ended_at: input.endedAt,
        planned_minutes: input.plannedMinutes,
        actual_minutes: input.actualMinutes,
      })
      .select()
      .single();
    const session = toFocus(must(r, 'save focus session'));
    this.state.focusSessions = [...this.state.focusSessions, session];
    return session;
  }

  private async ensureConversation(): Promise<string> {
    if (this.conversationId) return this.conversationId;
    const r = await this.db.from('conversations').insert({ user_id: this.userId }).select('id').single();
    this.conversationId = must(r, 'create conversation').id as string;
    return this.conversationId;
  }

  async sendChatMessage(text: string, personality: Personality) {
    const conversationId = await this.ensureConversation();
    const userRow = await this.db
      .from('messages')
      .insert({ conversation_id: conversationId, user_id: this.userId, role: 'user', content: text, personality })
      .select()
      .single();
    const user = toMessage(must(userRow, 'save message'));
    const history = [...this.state.messages, user].slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const ai = await aiChat({ ...this.persona(), personality }, history, this.chatContext());
    const turn = this.state.messages.filter((m) => m.role === 'user').length + 1;
    const replyRow = await this.db
      .from('messages')
      .insert({
        conversation_id: conversationId,
        user_id: this.userId,
        role: 'assistant',
        content: ai?.reply ?? previewReply(personality, text, turn),
        personality,
        source: ai?.source ?? 'offline',
      })
      .select()
      .single();
    const reply = toMessage(must(replyRow, 'save reply'));
    this.state.messages = [...this.state.messages, user, reply];
    return { user, reply };
  }

  async updatePreferences(patch: Partial<Preferences>) {
    const row: Row = {};
    for (const [k, v] of Object.entries(patch)) row[PREF_COLUMNS[k as keyof Preferences]] = v;
    const r = await this.db.from('user_preferences').update(row).eq('user_id', this.userId).select().single();
    const prefs = toPreferences(must(r, 'update preferences'));
    this.snapshotCache = { ...this.state, preferences: prefs };
    return prefs;
  }

  async updateProfile(patch: Parameters<Repository['updateProfile']>[0]) {
    const r = await this.db.from('profiles').update({ display_name: patch.displayName }).eq('id', this.userId).select().single();
    const profile = toProfile(must(r, 'update profile'));
    this.snapshotCache = { ...this.state, profile };
    return profile;
  }

  async checkRegret(text: string) {
    const trimmed = text.trim().slice(0, IMPULSE_MAX_LENGTH);
    if (!trimmed) throw new Error('Nə etmək istədiyini yaz.');
    const { personality, futureYear } = this.state.preferences;
    const answer = (await aiRegret(this.persona(), trimmed)) ?? {
      ...assessImpulse(trimmed, personality, fromYear(futureYear)),
      source: 'offline' as const,
    };
    const r = await this.db
      .from('regret_checks')
      .insert({
        user_id: this.userId,
        text: trimmed,
        category: answer.category,
        regret: answer.regret,
        verdict: answer.verdict.slice(0, 400),
        parallel: answer.parallel?.slice(0, 300) ?? null,
        personality,
        source: answer.source,
      })
      .select()
      .single();
    const check = toRegret(must(r, 'save regret check'));
    this.state.regretChecks = [...this.state.regretChecks, check];
    return check;
  }

  async setRegretOutcome(id: string, outcome: NonNullable<RegretCheck['outcome']>) {
    const r = await this.db.from('regret_checks').update({ outcome }).eq('id', id).select().single();
    const check = toRegret(must(r, 'save outcome'));
    this.state.regretChecks = this.state.regretChecks.map((c) => (c.id === id ? check : c));
    return check;
  }

  async exportData() {
    // Everything the user can read. Sealed letter bodies are locked by RLS until delivery;
    // a full export including them needs the server-side export function (planned).
    const tables = ['profiles', 'user_preferences', 'goals', 'missions', 'mission_completions', 'focus_sessions', 'letters', 'letter_contents', 'conversations', 'messages', 'regret_checks'];
    const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), mode: this.mode };
    for (const t of tables) out[t] = must(await this.db.from(t).select('*'), `export ${t}`);
    return out;
  }

  async reset(): Promise<Snapshot> {
    throw new Error('Real hesabda sıfırlama yoxdur.');
  }
}
