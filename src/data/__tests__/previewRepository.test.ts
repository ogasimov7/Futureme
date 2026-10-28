import AsyncStorage from '@react-native-async-storage/async-storage';

import { isDelivered } from '@/domain/letters';

import { PreviewRepository } from '../previewRepository';
import { previewReply } from '../previewResponder';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories must use require
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.useFakeTimers({ doNotFake: ['Date'] });

/** Runs a repository call to completion despite its simulated latency. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  await jest.runAllTimersAsync();
  return promise;
}

describe('PreviewRepository', () => {
  it('never returns the body of a sealed letter', async () => {
    const repo = new PreviewRepository('demo');
    const { letters } = await settle(repo.load());
    const now = new Date();
    const sealed = letters.filter((l) => !isDelivered(l, now));
    const delivered = letters.filter((l) => isDelivered(l, now));
    expect(sealed.length).toBeGreaterThan(0);
    expect(delivered.length).toBeGreaterThan(0);
    for (const l of sealed) expect(await settle(repo.readLetterBody(l.id))).toBeNull();
    for (const l of delivered) expect(await settle(repo.readLetterBody(l.id))).toEqual(expect.any(String));
  });

  it('refuses to mark a sealed letter as read', async () => {
    const repo = new PreviewRepository('demo');
    const { letters } = await settle(repo.load());
    const sealed = letters.find((l) => !isDelivered(l, new Date()))!;
    const assertion = expect(repo.markLetterRead(sealed.id)).rejects.toThrow('möhürlü');
    await jest.runAllTimersAsync();
    await assertion;
  });

  it('stores one completion per mission per day', async () => {
    const repo = new PreviewRepository('demo');
    await settle(repo.setMissionDone('m-run', '2030-01-01', true));
    await settle(repo.setMissionDone('m-run', '2030-01-01', true));
    const { completions } = await settle(repo.load());
    expect(completions.filter((c) => c.missionId === 'm-run' && c.localDate === '2030-01-01')).toHaveLength(1);
  });

  it('returns copies, so callers cannot mutate repository state', async () => {
    const repo = new PreviewRepository('demo');
    const first = await settle(repo.load());
    first.goals.length = 0;
    const second = await settle(repo.load());
    expect(second.goals.length).toBeGreaterThan(0);
  });
});

describe('previewReply', () => {
  it('drops the persona for crisis language in every personality', () => {
    for (const p of ['sarcastic', 'supportive', 'strict', 'absurd'] as const) {
      expect(previewReply(p, 'artıq yaşamaq istəmirəm', 1)).toMatch(/112/);
    }
  });
});

describe('PreviewRepository regret checks', () => {
  it('stores a check with the current persona year and records the outcome', async () => {
    const repo = new PreviewRepository('demo');
    await settle(repo.load());
    await settle(repo.updatePreferences({ futureYear: 2036, personality: 'sarcastic' }));
    const check = await settle(repo.checkRegret('Keçmişimə yazım?'));
    expect(check.category).toBe('ex');
    expect(check.regret).toBeGreaterThanOrEqual(82);
    const saved = await settle(repo.setRegretOutcome(check.id, 'skipped'));
    expect(saved.outcome).toBe('skipped');
    const { regretChecks } = await settle(repo.load());
    expect(regretChecks.find((c) => c.id === check.id)?.outcome).toBe('skipped');
  });

  it('rejects an empty question', async () => {
    const repo = new PreviewRepository('demo');
    const assertion = expect(repo.checkRegret('   ')).rejects.toThrow();
    await jest.runAllTimersAsync();
    await assertion;
  });

  it('persists state so a new instance sees earlier changes', async () => {
    const first = new PreviewRepository('demo');
    await settle(first.load());
    await settle(first.updateProfile({ displayName: 'Nigar' }));
    const second = new PreviewRepository('demo');
    const { profile } = await settle(second.load());
    expect(profile.displayName).toBe('Nigar');
  });
});

describe('PreviewRepository first launch', () => {
  it('starts empty and not onboarded by default, like a newly registered user', async () => {
    await AsyncStorage.clear();
    const { goals, letters, preferences } = await settle(new PreviewRepository().load());
    expect(goals).toHaveLength(0);
    expect(letters).toHaveLength(0);
    expect(preferences.onboarded).toBe(false);
  });
});

describe('PreviewRepository new-user reset', () => {
  it('starts empty and not onboarded, like a fresh account', async () => {
    const repo = new PreviewRepository('demo');
    await settle(repo.load());
    const fresh = await settle(repo.reset({ empty: true }));
    expect(fresh.preferences.onboarded).toBe(false);
    expect(fresh.profile.displayName).toBe('');
    for (const list of [fresh.goals, fresh.missions, fresh.completions, fresh.focusSessions, fresh.letters, fresh.messages, fresh.regretChecks]) {
      expect(list).toHaveLength(0);
    }
    const demo = await settle(repo.reset());
    expect(demo.goals.length).toBeGreaterThan(0);
  });
});
