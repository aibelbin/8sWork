import { describe, expect, it } from 'vitest';
import { buildDigests, renderDigest } from './digest';
import { makeApp, makeProfile, makeRound } from './test-fixtures';

const today = '2026-11-13';

describe('buildDigests', () => {
  it('groups items per user and skips users with nothing due', () => {
    const alice = makeProfile({ id: 'alice', email: 'alice@example.com' });
    const bob = makeProfile({ id: 'bob', email: 'bob@example.com' });
    const aliceApp = makeApp({ user_id: 'alice', follow_up_on: today });
    const bobApp = makeApp({ user_id: 'bob', follow_up_on: '2026-11-20' });
    const digests = buildDigests([alice, bob], [aliceApp, bobApp], [], today);
    expect(digests).toHaveLength(1);
    expect(digests[0].profile.id).toBe('alice');
    expect(digests[0].items.dueToday.map((a) => a.id)).toEqual([aliceApp.id]);
  });

  it('only uses rounds that belong to the same user', () => {
    const alice = makeProfile({ id: 'alice' });
    const aliceApp = makeApp({ user_id: 'alice' });
    const round = makeRound({ application_id: aliceApp.id, user_id: 'alice', scheduled_at: '2026-11-13T06:00:00Z' });
    const [digest] = buildDigests([alice], [aliceApp], [round], today);
    expect(digest.items.rounds.map((r) => r.id)).toEqual([round.id]);
  });

  it('skips users who turned the digest off or already got one today', () => {
    const off = makeProfile({ id: 'off', digest_enabled: false });
    const done = makeProfile({ id: 'done', last_digest_on: today });
    const due = makeProfile({ id: 'due', last_digest_on: '2026-11-12' });
    const apps = ['off', 'done', 'due'].map((user_id) => makeApp({ user_id, follow_up_on: today }));
    expect(buildDigests([off, done, due], apps, [], today).map((d) => d.profile.id)).toEqual(['due']);
  });
});

describe('renderDigest', () => {
  const profile = makeProfile();

  it('counts items in the subject', () => {
    const one = makeApp({ follow_up_on: today });
    const [digest] = buildDigests([profile], [one], [], today);
    expect(renderDigest(digest, 'https://x.test').subject).toBe('Job tracker: 1 thing to check today');
    const [two] = buildDigests([profile], [one, makeApp({ follow_up_on: '2026-11-01' })], [], today);
    expect(renderDigest(two, 'https://x.test').subject).toBe('Job tracker: 2 things to check today');
  });

  it('links each item to its application page', () => {
    const app = makeApp({ follow_up_on: today });
    const [digest] = buildDigests([profile], [app], [], today);
    const { text, html } = renderDigest(digest, 'https://x.test');
    expect(text).toContain(`https://x.test/applications/${app.id}`);
    expect(html).toContain(`href="https://x.test/applications/${app.id}"`);
  });

  it('escapes HTML in user-entered text', () => {
    const app = makeApp({ company: '<script>alert(1)</script>', follow_up_on: today });
    const [digest] = buildDigests([profile], [app], [], today);
    const { html } = renderDigest(digest, 'https://x.test');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
