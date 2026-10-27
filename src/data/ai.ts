/**
 * Client for the app's own AI routes (src/app/api). The Gemini key lives on that server,
 * never in the app. Relative URLs resolve to the dev server in development; production
 * builds need a deployed server (EAS Hosting) — see docs/PLAN.md.
 *
 * Every function returns null on any failure so callers can fall back to offline answers.
 */
import type { AnswerSource, Personality, RegretCategory } from '@/domain/types';

const TIMEOUT_MS = 20_000;

export type AiPersona = { personality: Personality; futureYear: number; futureSelfName: string; userName: string };

async function post<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type AiRegret = {
  category: RegretCategory;
  regret: number | null;
  verdict: string;
  parallel: string | null;
  source: AnswerSource;
};

export async function aiRegret(persona: AiPersona, text: string): Promise<AiRegret | null> {
  const data = await post<AiRegret>('/api/regret', { ...persona, text });
  return data && typeof data.verdict === 'string' ? data : null;
}

export async function aiChat(
  persona: AiPersona,
  messages: { role: 'user' | 'assistant'; content: string }[],
  context?: string,
): Promise<{ reply: string; source: AnswerSource } | null> {
  const data = await post<{ reply: string; source: AnswerSource }>('/api/chat', { ...persona, messages, context });
  return data && typeof data.reply === 'string' ? data : null;
}

/** Asks the server whether Gemini is configured. Null when the server can't be reached. */
export async function aiHealth(): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('/api/health', { signal: controller.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { ai?: unknown };
    return data.ai === true;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
