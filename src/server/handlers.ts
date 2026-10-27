/**
 * Request handlers for the AI routes, separated from the `+api.ts` files so they can be
 * tested with a fake Gemini client.
 *
 * Safety order: rate limit → validate → local crisis/danger check (never sent for a joke)
 * → Gemini → validate output. Any AI failure returns 503 and the app falls back to its
 * offline answers, labelled as such.
 */
import { categorize, sincereReply } from '@/domain/regret';

import { generate as geminiGenerate, type GeminiResult, type GeminiTurn } from './gemini';
import {
  chatSystemPrompt,
  cleanChatReply,
  parseChatInput,
  parseRegretInput,
  parseRegretOutput,
  REGRET_SCHEMA,
  regretSystemPrompt,
} from './prompts';
import { clientKey, takeToken } from './rateLimit';

type Generate = (opts: Parameters<typeof geminiGenerate>[0]) => Promise<GeminiResult>;

const json = (status: number, body: unknown) => Response.json(body, { status });

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function unavailable(reason: string) {
  return json(reason === 'quota' ? 429 : 503, { error: 'ai_unavailable', reason });
}

export async function handleRegret(request: Request, generate: Generate = geminiGenerate) {
  if (!takeToken(clientKey(request))) return json(429, { error: 'rate_limited' });
  const input = parseRegretInput(await readJson(request));
  if (!input.ok) return json(400, { error: 'invalid_input', field: input.error });

  const local = categorize(input.value.text);
  if (local === 'crisis' || local === 'danger') {
    return json(200, { category: local, regret: null, verdict: sincereReply(local), parallel: null, source: 'offline' });
  }

  const result = await generate({
    system: regretSystemPrompt(input.value),
    turns: [{ role: 'user', text: input.value.text }],
    jsonSchema: REGRET_SCHEMA,
    maxOutputTokens: 1024,
  });
  if (!result.ok) return unavailable(result.reason);
  const out = parseRegretOutput(result.text);
  if (!out) return unavailable('bad_output');
  // If the model itself flags danger/crisis, use our fixed sincere wording.
  if (out.category === 'crisis' || out.category === 'danger') {
    return json(200, { ...out, regret: null, parallel: null, verdict: sincereReply(out.category), source: 'ai' });
  }
  return json(200, { ...out, source: 'ai' });
}

export async function handleChat(request: Request, generate: Generate = geminiGenerate) {
  if (!takeToken(clientKey(request))) return json(429, { error: 'rate_limited' });
  const input = parseChatInput(await readJson(request));
  if (!input.ok) return json(400, { error: 'invalid_input', field: input.error });

  const last = input.value.messages[input.value.messages.length - 1].content;
  if (categorize(last) === 'crisis') return json(200, { reply: sincereReply('crisis'), source: 'offline' });

  const turns: GeminiTurn[] = input.value.messages.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', text: m.content }));
  const result = await generate({
    system: chatSystemPrompt(input.value, input.value.context),
    turns,
    maxOutputTokens: 1024,
  });
  if (!result.ok) return unavailable(result.reason);
  const reply = cleanChatReply(result.text);
  if (!reply) return unavailable('bad_output');
  return json(200, { reply, source: 'ai' });
}
