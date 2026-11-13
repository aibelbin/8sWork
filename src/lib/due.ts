import { addDays, istDate, type ISODate } from './dates';
import { isOpen, type Application, type Round } from './domain';

export type DueWindows = { roundDays: number; deadlineDays: number };
export const TODAY_WINDOWS: DueWindows = { roundDays: 7, deadlineDays: 7 };
export const DIGEST_WINDOWS: DueWindows = { roundDays: 1, deadlineDays: 2 };

export type RoundWithApp = Round & { application: Application };
export type DueItems = {
  overdue: Application[];
  dueToday: Application[];
  rounds: RoundWithApp[];
  deadlines: Application[];
};

const by = <T>(key: (item: T) => string) => (a: T, b: T) => key(a).localeCompare(key(b));

// ISO date strings compare correctly as plain strings.
export function collectDue(apps: Application[], rounds: Round[], today: ISODate, windows: DueWindows): DueItems {
  const open = apps.filter((a) => isOpen(a.status));
  const byId = new Map(open.map((a) => [a.id, a]));
  const roundEnd = addDays(today, windows.roundDays);
  const deadlineEnd = addDays(today, windows.deadlineDays);

  return {
    overdue: open.filter((a) => a.follow_up_on && a.follow_up_on < today).sort(by((a) => a.follow_up_on!)),
    dueToday: open.filter((a) => a.follow_up_on === today),
    rounds: rounds
      .filter((r) => {
        if (r.result !== 'upcoming' || !r.scheduled_at || !byId.has(r.application_id)) return false;
        const day = istDate(r.scheduled_at);
        return day >= today && day <= roundEnd;
      })
      .sort(by((r) => r.scheduled_at!))
      .map((r) => ({ ...r, application: byId.get(r.application_id)! })),
    deadlines: open
      .filter((a) => a.status === 'to_apply' && a.deadline && a.deadline >= today && a.deadline <= deadlineEnd)
      .sort(by((a) => a.deadline!)),
  };
}

export function isEmpty(items: DueItems): boolean {
  return !items.overdue.length && !items.dueToday.length && !items.rounds.length && !items.deadlines.length;
}
