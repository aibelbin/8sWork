import { describe, expect, it } from 'vitest';
import { collectDue, DIGEST_WINDOWS, isEmpty } from './due';
import { makeApp, makeRound } from './test-fixtures';

const today = '2026-11-13';

describe('collectDue', () => {
  it('splits follow-ups into overdue (oldest first) and due today', () => {
    const older = makeApp({ follow_up_on: '2026-11-10' });
    const yesterday = makeApp({ follow_up_on: '2026-11-12' });
    const dueToday = makeApp({ follow_up_on: today });
    const future = makeApp({ follow_up_on: '2026-11-14' });
    const due = collectDue([yesterday, future, dueToday, older], [], today, DIGEST_WINDOWS);
    expect(due.overdue.map((a) => a.id)).toEqual([older.id, yesterday.id]);
    expect(due.dueToday.map((a) => a.id)).toEqual([dueToday.id]);
  });

  it('leaves out closed applications everywhere', () => {
    const closed = makeApp({ status: 'rejected', follow_up_on: '2026-11-12' });
    const round = makeRound({ application_id: closed.id, scheduled_at: '2026-11-13T06:00:00Z' });
    const due = collectDue([closed], [round], today, DIGEST_WINDOWS);
    expect(isEmpty(due)).toBe(true);
  });

  it('includes upcoming rounds within the window by IST date, with their application', () => {
    const app = makeApp();
    const tomorrowIst = makeRound({ application_id: app.id, scheduled_at: '2026-11-14T12:00:00Z' });
    const dayAfterIst = makeRound({ application_id: app.id, scheduled_at: '2026-11-14T18:30:00Z' }); // 15 Nov 00:00 IST
    const past = makeRound({ application_id: app.id, scheduled_at: '2026-11-12T06:00:00Z' });
    const passed = makeRound({ application_id: app.id, scheduled_at: '2026-11-13T06:00:00Z', result: 'passed' });
    const due = collectDue([app], [dayAfterIst, past, passed, tomorrowIst], today, DIGEST_WINDOWS);
    expect(due.rounds.map((r) => r.id)).toEqual([tomorrowIst.id]);
    expect(due.rounds[0].application.id).toBe(app.id);
  });

  it('includes to_apply deadlines within the window', () => {
    const inWindow = makeApp({ status: 'to_apply', deadline: '2026-11-15' });
    const tooLate = makeApp({ status: 'to_apply', deadline: '2026-11-16' });
    const passedDeadline = makeApp({ status: 'to_apply', deadline: '2026-11-12' });
    const alreadyApplied = makeApp({ status: 'applied', deadline: '2026-11-14' });
    const due = collectDue([tooLate, inWindow, passedDeadline, alreadyApplied], [], today, DIGEST_WINDOWS);
    expect(due.deadlines.map((a) => a.id)).toEqual([inWindow.id]);
  });
});
