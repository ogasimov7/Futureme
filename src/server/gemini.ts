/**
 * Minimal Gemini REST client (models.generateContent). Server-only: reads GEMINI_API_KEY
 * from the environment, which never reaches the app bundle.
 * Docs: https://ai.google.dev/api/generate-content
 */

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 15_000;

export type GeminiTurn = { role: 'user' | 'model'; text: string };

export type GeminiResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'no_key' | 'blocked' | 'quota' | 'timeout' | 'upstream' | 'empty' };

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function generate(opts: {
  system: string;
  turns: GeminiTurn[];
  /** When set, the model must answer with JSON matching this (OpenAPI-subset) schema. */
  jsonSchema?: object;
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: 'no_key' };
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.turns.map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
    generationConfig: {
      temperature: opts.temperature ?? 1,
      maxOutputTokens: opts.maxOutputTokens ?? 1024,
      ...(opts.jsonSchema ? { responseMimeType: 'application/json', responseSchema: opts.jsonSchema } : {}),
    },
    safetySettings: [
      // Gentle roasting is rated MEDIUM harassment even for "Salam" (measured 2026-10-28), so
      // MEDIUM would block every chat reply. Only HIGH is blocked here; the prompt rules and the
      // local crisis check before the call keep the tone in bounds.
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (res.status === 429) return { ok: false, reason: 'quota' };
    if (!res.ok) {
      // Log status only; the response body can echo the prompt.
      console.warn(`[gemini] HTTP ${res.status} for model ${model}`);
      return { ok: false, reason: 'upstream' };
    }
    const data = (await res.json()) as {
      promptFeedback?: { blockReason?: string };
      candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    };
    if (data.promptFeedback?.blockReason) return { ok: false, reason: 'blocked' };
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') return { ok: false, reason: 'blocked' };
    // Skip any "thought" parts some models return; keep only the answer text.
    const text = (candidate?.content?.parts ?? [])
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('')
      .trim();
    return text ? { ok: true, text } : { ok: false, reason: 'empty' };
  } catch (e) {
    return { ok: false, reason: e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'upstream' };
  } finally {
    clearTimeout(timer);
  }
}
