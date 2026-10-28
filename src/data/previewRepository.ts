import AsyncStorage from '@react-native-async-storage/async-storage';

import { deviceTimeZone, localDateOf } from '@/domain/dates';
import { deliveryInstant, isDelivered } from '@/domain/letters';
import { assessImpulse, IMPULSE_MAX_LENGTH } from '@/domain/regret';
import type { RegretCheck } from '@/domain/types';
import { fromYear } from '@/lib/format';

import { aiChat, aiRegret, type AiPersona } from './ai';
import { previewReply } from './previewResponder';
import type { Repository, Snapshot } from './repository';
import { createSeed } from './seed';
import { splitLetters, todaysMissions, weekStats } from './selectors';

const LATENCY_MS = 220;
const REPLY_LATENCY_MS = 1100;
const STORAGE_KEY = 'future-roast/preview/v2';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let idCounter = 0;
const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(idCounter++).toString(36)}`;

type Stored = { snapshot: Snapshot; letterBodies: [string, string][] };

/**
 * Seeded demo data with simulated latency, so loading states are visible. State is saved
 * on the device (AsyncStorage) so onboarding and anything the user creates survive reloads.
 * It follows the server rules (sealed letters return no body) so the UI is built against
 * the real contract.
 */
export class PreviewRepository implements Repository {
  readonly mode = 'preview' as const;
  private state!: Snapshot;
  private letterBodies!: Map<string, string>;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.restore();
  }

  private seed(empty = false) {
    const { snapshot, letterBodies } = createSeed(new Date(), deviceTimeZone(), { empty });
    this.state = snapshot;
    this.letterBodies = letterBodies;
  }

  private async restore() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const stored = JSON.parse(raw) as Stored;
        this.state = stored.snapshot;
        this.letterBodies = new Map(stored.letterBodies);
        return;
      }
    } catch {
      // Corrupt or unavailable storage: fall back to a fresh seed.
    }
    this.seed();
  }

  /** Best effort: a failed save only means the next launch starts from older data. */
  private persist() {
    const stored: Stored = { snapshot: this.state, letterBodies: [...this.letterBodies] };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stored)).catch(() => {});
  }

  private persona(): AiPersona {
    const { personality, futureYear, futureSelfName } = this.state.preferences;
    return { personality, futureYear, futureSelfName, userName: this.state.profile.displayName };
  }

  /** True facts for the chat prompt, only when the user allowed it in Privacy settings. */
  private chatContext(): string | undefined {
    if (!this.state.preferences.shareStatsWithAi) return undefined;
    const now = new Date();
    const today = localDateOf(now, this.state.profile.timeZone);
    const missions = todaysMissions(this.state, today);
    const done = missions.filter((m) => m.done);
    const week = weekStats(this.state, today);
    const sealed = splitLetters(this.state, now).sealed.length;
    return [
      `Bu gün: ${done.length}/${missions.length} missiya hazırdır.`,
      missions.length > done.length ? `Qalan missiyalar: ${missions.filter((m) => !m.done).map((m) => m.mission.title).join(', ')}.` : null,
      `Ən uzun aktiv seriya: ${Math.max(0, ...missions.map((m) => m.streak))} gün.`,
      `Bu həftə fokus: ${week.focusMinutes} dəqiqə.`,
      `Yolda ${sealed} möhürlü məktub var.`,
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 600);
  }

  private snapshot(): Snapshot {
    // JSON clone: everything here is plain data, and structuredClone isn't guaranteed on Hermes.
    return JSON.parse(JSON.stringify(this.state)) as Snapshot;
  }

  async load() {
    await Promise.all([this.ready, wait(LATENCY_MS * 2)]);
    return this.snapshot();
  }

  async setMissionDone(missionId: string, localDate: string, done: boolean) {
    await wait(LATENCY_MS);
    this.state.completions = this.state.completions.filter(
      (c) => !(c.missionId === missionId && c.localDate === localDate),
    );
    const completion = done ? { id: newId('c'), missionId, localDate, completedAt: new Date().toISOString() } : null;
    if (completion) this.state.completions.push(completion);
    this.persist();
    return completion;
  }

  async createGoal(input: { title: string; why: string | null }) {
    await wait(LATENCY_MS);
    const goal = { id: newId('g'), ...input, createdAt: new Date().toISOString(), archivedAt: null };
    this.state.goals.push(goal);
    this.persist();
    return goal;
  }

  async createMission(input: Parameters<Repository['createMission']>[0]) {
    await wait(LATENCY_MS);
    const mission = { id: newId('m'), ...input, createdAt: new Date().toISOString(), archivedAt: null };
    this.state.missions.push(mission);
    this.persist();
    return mission;
  }

  async createLetter(input: Parameters<Repository['createLetter']>[0]) {
    await wait(LATENCY_MS * 2);
    const letter = {
      id: newId('l'),
      title: input.title,
      createdAt: new Date().toISOString(),
      deliverAt: deliveryInstant(input.deliverOn, input.timeZone).toISOString(),
      deliveryTimeZone: input.timeZone,
      readAt: null,
    };
    this.state.letters.push(letter);
    this.letterBodies.set(letter.id, input.body);
    this.persist();
    return letter;
  }

  async deleteLetter(id: string) {
    await wait(LATENCY_MS);
    this.state.letters = this.state.letters.filter((l) => l.id !== id);
    this.letterBodies.delete(id);
    this.persist();
  }

  async readLetterBody(id: string) {
    await wait(LATENCY_MS);
    const letter = this.state.letters.find((l) => l.id === id);
    if (!letter || !isDelivered(letter, new Date())) return null;
    return this.letterBodies.get(id) ?? null;
  }

  async markLetterRead(id: string) {
    await wait(LATENCY_MS);
    const letter = this.state.letters.find((l) => l.id === id);
    if (!letter) throw new Error('Məktub tapılmadı.');
    if (!isDelivered(letter, new Date())) throw new Error('Bu məktub hələ möhürlüdür.');
    letter.readAt ??= new Date().toISOString();
    this.persist();
    return { ...letter };
  }

  async saveFocusSession(input: Parameters<Repository['saveFocusSession']>[0]) {
    await wait(LATENCY_MS);
    const session = { id: newId('f'), ...input };
    this.state.focusSessions.push(session);
    this.persist();
    return session;
  }

  async sendChatMessage(text: string, personality: Parameters<Repository['sendChatMessage']>[1]) {
    const user = { id: newId('msg'), role: 'user' as const, content: text, personality, createdAt: new Date().toISOString() };
    this.state.messages.push(user);
    const history = this.state.messages.slice(-12).map((m) => ({ role: m.role, content: m.content }));
    const ai = await aiChat({ ...this.persona(), personality }, history, this.chatContext());
    if (!ai) await wait(REPLY_LATENCY_MS);
    const turn = this.state.messages.filter((m) => m.role === 'user').length;
    const reply = {
      id: newId('msg'),
      role: 'assistant' as const,
      content: ai?.reply ?? previewReply(personality, text, turn),
      personality,
      createdAt: new Date().toISOString(),
      source: ai?.source ?? ('offline' as const),
    };
    this.state.messages.push(reply);
    this.persist();
    return { user, reply };
  }

  async updatePreferences(patch: Parameters<Repository['updatePreferences']>[0]) {
    await wait(LATENCY_MS / 2);
    this.state.preferences = { ...this.state.preferences, ...patch };
    this.persist();
    return { ...this.state.preferences };
  }

  async updateProfile(patch: Parameters<Repository['updateProfile']>[0]) {
    await wait(LATENCY_MS / 2);
    this.state.profile = { ...this.state.profile, ...patch };
    this.persist();
    return { ...this.state.profile };
  }

  async checkRegret(text: string) {
    const trimmed = text.trim().slice(0, IMPULSE_MAX_LENGTH);
    if (!trimmed) throw new Error('Nə etmək istədiyini yaz.');
    const { personality, futureYear } = this.state.preferences;
    const ai = await aiRegret(this.persona(), trimmed);
    if (!ai) await wait(REPLY_LATENCY_MS);
    const answer = ai ?? { ...assessImpulse(trimmed, personality, fromYear(futureYear)), source: 'offline' as const };
    const check: RegretCheck = {
      id: newId('r'),
      text: trimmed,
      category: answer.category,
      regret: answer.regret,
      verdict: answer.verdict,
      parallel: answer.parallel,
      personality,
      createdAt: new Date().toISOString(),
      outcome: null,
      source: answer.source,
    };
    this.state.regretChecks.push(check);
    this.persist();
    return { ...check };
  }

  async setRegretOutcome(id: string, outcome: NonNullable<RegretCheck['outcome']>) {
    await wait(LATENCY_MS / 2);
    const check = this.state.regretChecks.find((c) => c.id === id);
    if (!check) throw new Error('Yoxlama tapılmadı.');
    check.outcome = outcome;
    this.persist();
    return { ...check };
  }

  async exportData() {
    await wait(LATENCY_MS);
    // A data export is the user's right of access, so it includes sealed letter bodies too.
    return {
      exportedAt: new Date().toISOString(),
      mode: this.mode,
      ...this.snapshot(),
      letterBodies: Object.fromEntries(this.letterBodies),
    };
  }

  async reset(options: { empty?: boolean } = {}) {
    await wait(LATENCY_MS);
    this.seed(options.empty);
    this.persist();
    return this.snapshot();
  }
}
