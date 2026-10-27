import { handleChat, handleRegret } from '../handlers';
import { chatSystemPrompt, parseRegretOutput, regretSystemPrompt } from '../prompts';
import { resetRateLimits, takeToken } from '../rateLimit';

const persona = { personality: 'sarcastic', futureYear: 2031, futureSelfName: 'Böyük Nigar', userName: 'Nigar' };
const post = (body: unknown, ip = '1.1.1.1') =>
  new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

beforeEach(() => resetRateLimits());

describe('handleRegret', () => {
  it('returns validated AI output', async () => {
    const generate = jest.fn().mockResolvedValue({
      ok: true,
      text: JSON.stringify({ category: 'shopping', regret: 140, verdict: 'Bunu 3 dəfə geyinəcəksən.', parallel: 'Paralel kainatdakı sən almadı.' }),
    });
    const res = await handleRegret(post({ ...persona, text: '200 AZN-ə ayaqqabı alım?' }), generate);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ category: 'shopping', regret: 100, source: 'ai' });
    expect(generate.mock.calls[0][0].system).toContain('2031');
  });

  it('never sends crisis messages to the AI', async () => {
    const generate = jest.fn();
    const res = await handleRegret(post({ ...persona, text: 'daha yaşamaq istəmirəm' }), generate);
    expect(generate).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.regret).toBeNull();
    expect(body.verdict).toMatch(/112/);
  });

  it('replaces a model-flagged danger answer with the fixed sincere reply', async () => {
    const generate = jest.fn().mockResolvedValue({
      ok: true,
      text: JSON.stringify({ category: 'danger', regret: 50, verdict: 'haha', parallel: 'x' }),
    });
    const body = await (await handleRegret(post({ ...persona, text: 'bir şey edim?' }), generate)).json();
    expect(body).toMatchObject({ category: 'danger', regret: null, parallel: null });
    expect(body.verdict).not.toBe('haha');
  });

  it('rejects invalid input without calling the AI', async () => {
    const generate = jest.fn();
    expect((await handleRegret(post({ ...persona, text: '' }), generate)).status).toBe(400);
    expect((await handleRegret(post({ ...persona, personality: 'evil', text: 'x' }), generate)).status).toBe(400);
    expect((await handleRegret(post({ ...persona, futureYear: 1999, text: 'x' }), generate)).status).toBe(400);
    expect((await handleRegret(post({ ...persona, text: 'x'.repeat(201) }), generate)).status).toBe(400);
    expect(generate).not.toHaveBeenCalled();
  });

  it('reports AI failures as unavailable so the app can fall back', async () => {
    const noKey = jest.fn().mockResolvedValue({ ok: false, reason: 'no_key' });
    expect((await handleRegret(post({ ...persona, text: 'pizza yeyim?' }), noKey)).status).toBe(503);
    const garbage = jest.fn().mockResolvedValue({ ok: true, text: 'not json' });
    expect((await handleRegret(post({ ...persona, text: 'pizza yeyim?' }), garbage)).status).toBe(503);
  });
});

describe('handleChat', () => {
  it('maps history to Gemini roles and includes approved context', async () => {
    const generate = jest.fn().mockResolvedValue({ ok: true, text: '  Yenə sabaha saxladın?  ' });
    const res = await handleChat(
      post({
        ...persona,
        messages: [
          { role: 'user', content: 'Salam' },
          { role: 'assistant', content: 'Salam, keçmiş mən.' },
          { role: 'user', content: 'Düz yoldayam?' },
        ],
        context: 'Bu gün: 2/5 missiya hazırdır.',
      }),
      generate,
    );
    expect(await res.json()).toEqual({ reply: 'Yenə sabaha saxladın?', source: 'ai' });
    const call = generate.mock.calls[0][0];
    expect(call.turns.map((t: { role: string }) => t.role)).toEqual(['user', 'model', 'user']);
    expect(call.system).toContain('2/5 missiya');
  });

  it('requires the last message to be from the user', async () => {
    const res = await handleChat(post({ ...persona, messages: [{ role: 'assistant', content: 'hi' }] }), jest.fn());
    expect(res.status).toBe(400);
  });
});

describe('rate limiting', () => {
  it('limits bursts per client', () => {
    const now = 1_000_000;
    const results = Array.from({ length: 13 }, () => takeToken('ip', now));
    expect(results.filter(Boolean)).toHaveLength(12);
    expect(takeToken('other-ip', now)).toBe(true);
    expect(takeToken('ip', now + 61_000)).toBe(true);
  });
});

describe('prompts', () => {
  it('state the persona and the safety rules', () => {
    for (const prompt of [regretSystemPrompt(persona as never), chatSystemPrompt(persona as never)]) {
      expect(prompt).toContain('Böyük Nigar');
      expect(prompt).toContain('2031-ci ildən');
      expect(prompt).toContain('Azerbaijani');
      expect(prompt).toContain('112');
    }
  });

  it('rejects output missing a verdict or with an unknown category', () => {
    expect(parseRegretOutput(JSON.stringify({ category: 'shopping', regret: 50, verdict: '' }))).toBeNull();
    expect(parseRegretOutput(JSON.stringify({ category: 'weird', regret: 50, verdict: 'x' }))).toBeNull();
    expect(parseRegretOutput(JSON.stringify({ category: 'food', regret: null, verdict: 'x' }))).toBeNull();
  });
});
